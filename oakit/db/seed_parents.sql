-- PARENT TEST SEED
-- Run this in Supabase SQL Editor to create test parent accounts
-- Requires: pgcrypto extension (enabled by default in Supabase)
-- School: sojs (a0000000-0000-0000-0000-000000000001)
-- Password for each parent = their mobile number

-- Apply migration 028 first if not done
CREATE TABLE IF NOT EXISTS school_settings (
    school_id           UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
    notes_expiry_days   INT NOT NULL DEFAULT 14,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO school_settings (school_id, notes_expiry_days)
VALUES ('a0000000-0000-0000-0000-000000000001', 14)
ON CONFLICT (school_id) DO NOTHING;

-- Clean existing test parents
DELETE FROM parent_student_links
WHERE parent_id IN (
  SELECT id FROM parent_users
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001'
    AND mobile LIKE '990000000%'
);
DELETE FROM parent_users
WHERE school_id = 'a0000000-0000-0000-0000-000000000001'
  AND mobile LIKE '990000000%';

-- Insert parents with password = mobile (bcrypt via pgcrypto)
INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '9900000001', 'Rajesh Sharma',
   crypt('9900000001', gen_salt('bf', 12)), false, true),

  ('a0000000-0000-0000-0000-000000000001', '9900000002', 'Amit Mehta',
   crypt('9900000002', gen_salt('bf', 12)), false, true),

  ('a0000000-0000-0000-0000-000000000001', '9900000003', 'Anil Verma',
   crypt('9900000003', gen_salt('bf', 12)), false, true),

  ('a0000000-0000-0000-0000-000000000001', '9900000004', 'Rohit Sharma',
   crypt('9900000004', gen_salt('bf', 12)), false, true),

  ('a0000000-0000-0000-0000-000000000001', '9900000005', 'Farhan Ahmed',
   crypt('9900000005', gen_salt('bf', 12)), false, true),

  -- Twin/sibling parent: linked to 2 children — tests multi-child switcher
  ('a0000000-0000-0000-0000-000000000001', '9900000006', 'Suresh Patel',
   crypt('9900000006', gen_salt('bf', 12)), false, true);

-- Link parents to their children
INSERT INTO parent_student_links (parent_id, student_id)
SELECT pu.id, st.id
FROM parent_users pu, students st
WHERE pu.school_id = 'a0000000-0000-0000-0000-000000000001'
  AND st.school_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    (pu.mobile = '9900000001' AND st.name = 'Aarav Sharma')  OR
    (pu.mobile = '9900000002' AND st.name = 'Ishaan Mehta')  OR
    (pu.mobile = '9900000003' AND st.name = 'Riya Verma')    OR
    (pu.mobile = '9900000004' AND st.name = 'Advait Sharma') OR
    (pu.mobile = '9900000005' AND st.name = 'Zara Ahmed')    OR
    -- Suresh Patel linked to BOTH kids (multi-child test)
    (pu.mobile = '9900000006' AND st.name = 'Diya Patel')    OR
    (pu.mobile = '9900000006' AND st.name = 'Arjun Kumar')
  )
ON CONFLICT DO NOTHING;

-- Seed some homework and notes for today so parent portal has data to show
-- (Uses UKG-A section where Advait and Zara are)
DO $$
DECLARE
  ukg_a_id UUID;
  teacher_id UUID;
  today DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO ukg_a_id
  FROM sections WHERE class_id = 'd0000000-0000-0000-0000-000000000004' AND label = 'A';

  SELECT id INTO teacher_id
  FROM users WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '8666666666';

  IF ukg_a_id IS NULL OR teacher_id IS NULL THEN
    RAISE NOTICE 'Section or teacher not found — skipping homework/notes seed';
    RETURN;
  END IF;

  -- Today's homework
  INSERT INTO teacher_homework (school_id, section_id, teacher_id, homework_date, raw_text, formatted_text)
  VALUES (
    'a0000000-0000-0000-0000-000000000001',
    ukg_a_id, teacher_id, today,
    'Practice writing letters A to E. Count objects at home up to 10.',
    '📝 Homework for today:
• Practice writing letters A to E in your notebook
• Count objects at home — find 10 things and count them out loud
• Read the story we did in class with a parent'
  )
  ON CONFLICT (section_id, homework_date) DO UPDATE
    SET raw_text = EXCLUDED.raw_text, formatted_text = EXCLUDED.formatted_text;

  -- Today's note (with ON CONFLICT guard to prevent duplicates)
  INSERT INTO teacher_notes (school_id, section_id, teacher_id, note_date, note_text, expires_at)
  SELECT
    'a0000000-0000-0000-0000-000000000001',
    ukg_a_id, teacher_id, today,
    'Dear Parents, we had a wonderful session on shapes today! The children were very enthusiastic. Please revise circle, square, and triangle at home. Also, please ensure your child brings their water bottle tomorrow.',
    now() + INTERVAL '14 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM teacher_notes
    WHERE section_id = ukg_a_id AND note_date = today
      AND note_text LIKE 'Dear Parents, we had a wonderful session on shapes%'
  );

END $$;

-- Verify
SELECT
  pu.mobile,
  pu.name as parent_name,
  pu.is_active,
  string_agg(st.name || ' (' || c.name || ' ' || sec.label || ')', ', ') as children
FROM parent_users pu
LEFT JOIN parent_student_links psl ON psl.parent_id = pu.id
LEFT JOIN students st ON st.id = psl.student_id
LEFT JOIN classes c ON c.id = st.class_id
LEFT JOIN sections sec ON sec.id = st.section_id
WHERE pu.school_id = 'a0000000-0000-0000-0000-000000000001'
  AND pu.mobile LIKE '990000000%'
GROUP BY pu.id, pu.mobile, pu.name, pu.is_active
ORDER BY pu.mobile;

-- ─── ALTERNATIVE: If pgcrypto hashes don't work with bcryptjs ────────────────
-- Use the Admin UI: Admin → Students → click a student → Parents panel → Activate
-- This calls the API which uses bcryptjs directly (guaranteed compatible).
--
-- OR run this Node.js snippet to generate correct hashes:
--   const bcrypt = require('bcryptjs');
--   const mobiles = ['9900000001','9900000002','9900000003','9900000004','9900000005','9900000006'];
--   for (const m of mobiles) console.log(m, await bcrypt.hash(m, 12));
-- Then UPDATE parent_users SET password_hash = '<hash>' WHERE mobile = '<mobile>';
--
-- ─── TEST LOGINS ─────────────────────────────────────────────────────────────
-- School code: sojs
-- Mobile          Password      Child(ren)
-- 9900000001      9900000001    Aarav Sharma (PG-A)
-- 9900000002      9900000002    Ishaan Mehta (Nur-A)
-- 9900000003      9900000003    Riya Verma (LKG-A)
-- 9900000004      9900000004    Advait Sharma (UKG-A)  ← has homework + notes today
-- 9900000005      9900000005    Zara Ahmed (UKG-A)     ← has 2 absences in history
-- 9900000006      9900000006    Diya Patel + Arjun Kumar (TWINS — multi-child test)

-- ─── Clean up duplicate notes (run if you see notes appearing twice) ──────────
DELETE FROM teacher_notes
WHERE id NOT IN (
  SELECT DISTINCT ON (section_id, note_date, COALESCE(note_text,''), COALESCE(file_name,''))
    id
  FROM teacher_notes
  ORDER BY section_id, note_date, COALESCE(note_text,''), COALESCE(file_name,''), created_at ASC
);

-- ─── Add mother info to existing students ────────────────────────────────────
-- Run this if mother_name / mother_contact columns are empty

UPDATE students SET mother_name = 'Priya Sharma',   mother_contact = '9900100001'
WHERE name = 'Aarav Sharma'   AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET parent_contact = '9900000001'
WHERE name = 'Aarav Sharma'   AND school_id = 'a0000000-0000-0000-0000-000000000001'
  AND (parent_contact IS NULL OR parent_contact = '');

UPDATE students SET mother_name = 'Sunita Mehta',   mother_contact = '9900100002'
WHERE name = 'Ishaan Mehta'   AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET mother_name = 'Kavita Verma',   mother_contact = '9900100003'
WHERE name = 'Riya Verma'     AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET mother_name = 'Neha Sharma',    mother_contact = '9900100004'
WHERE name = 'Advait Sharma'  AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET mother_name = 'Sana Ahmed',     mother_contact = '9900100005'
WHERE name = 'Zara Ahmed'     AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET mother_name = 'Meena Patel',    mother_contact = '9900100006'
WHERE name = 'Diya Patel'     AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET mother_name = 'Meena Patel',    mother_contact = '9900100006'
WHERE name = 'Arjun Kumar'    AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Verify
SELECT name, father_name, mother_name, parent_contact, mother_contact
FROM students
WHERE school_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Aarav Sharma','Ishaan Mehta','Riya Verma','Advait Sharma','Zara Ahmed','Diya Patel','Arjun Kumar')
ORDER BY name;
