-- ============================================================
-- OAKIT INVESTOR DEMO SEED — UKG Class, Silver Oak Juniors
-- Run in Supabase SQL Editor (paste full file, click Run)
-- School ID: a0000000-0000-0000-0000-000000000001
-- ============================================================
-- LOGINS AFTER RUNNING:
--   ADMIN     : mobile 9800000001  password 9800000001
--   PRINCIPAL : mobile 9800000002  password 9800000002
--   TEACHER   : mobile 9800000003  password 9800000003
--   PARENT 1  : mobile 9800000004  password 9800000004  (Aarav)
--   PARENT 2  : mobile 9800000005  password 9800000005  (Priya — 2 kids)
-- ============================================================

-- ── 0. SAFETY: wipe previous demo data ──────────────────────
DO $$
DECLARE
  sid UUID := 'a0000000-0000-0000-0000-000000000001';
  demo_mobiles TEXT[] := ARRAY['9800000001','9800000002','9800000003'];
  demo_parent_mobiles TEXT[] := ARRAY['9800000004','9800000005'];
  ukg_class_id UUID;
  ukg_section_id UUID;
BEGIN
  -- get IDs if they exist
  SELECT id INTO ukg_class_id FROM classes WHERE school_id=sid AND name='UKG' LIMIT 1;
  IF ukg_class_id IS NOT NULL THEN
    SELECT id INTO ukg_section_id FROM sections WHERE class_id=ukg_class_id AND label='A' LIMIT 1;
  END IF;

  -- clean child journey
  IF ukg_section_id IS NOT NULL THEN
    -- 1. child journey & observations (no FK to students cascade issue)
    DELETE FROM child_journey_entries WHERE section_id=ukg_section_id;
    DELETE FROM student_observations   WHERE school_id=sid;
    DELETE FROM messages               WHERE school_id=sid;
    DELETE FROM announcements          WHERE school_id=sid AND author_id IN (
      SELECT id FROM users WHERE school_id=sid AND mobile=ANY(demo_mobiles));

    -- 2. homework / notes / attendance / completions / plans
    DELETE FROM homework_submissions WHERE section_id=ukg_section_id;
    DELETE FROM teacher_homework     WHERE section_id=ukg_section_id;
    DELETE FROM teacher_notes        WHERE section_id=ukg_section_id;
    DELETE FROM attendance_records   WHERE section_id=ukg_section_id;
    DELETE FROM daily_completions    WHERE section_id=ukg_section_id;
    DELETE FROM day_plans            WHERE section_id=ukg_section_id;
    DELETE FROM teacher_sections     WHERE section_id=ukg_section_id;
  END IF;

  -- 3. parent links & parents (before students)
  DELETE FROM parent_student_links WHERE parent_id IN (
    SELECT id FROM parent_users WHERE school_id=sid AND mobile=ANY(demo_parent_mobiles));
  DELETE FROM parent_users WHERE school_id=sid AND mobile=ANY(demo_parent_mobiles);

  -- 4. demo students (must be before section delete)
  DELETE FROM students WHERE school_id=sid AND name IN (
    'Aarav Kapoor','Priya Nair','Rohan Mehta','Ananya Singh','Dev Patel','Sia Sharma');

  -- 5. demo staff users (streaks first, then sections assignment, then user)
  DELETE FROM teacher_streaks  WHERE teacher_id IN (
    SELECT id FROM users WHERE school_id=sid AND mobile=ANY(demo_mobiles));
  DELETE FROM teacher_sections WHERE teacher_id IN (
    SELECT id FROM users WHERE school_id=sid AND mobile=ANY(demo_mobiles));
  DELETE FROM users WHERE school_id=sid AND mobile=ANY(demo_mobiles);

  -- 6. curriculum chunks & documents for UKG demo doc
  IF ukg_class_id IS NOT NULL THEN
    DELETE FROM curriculum_chunks WHERE document_id IN (
      SELECT id FROM curriculum_documents WHERE class_id=ukg_class_id AND checksum='demo_checksum_ukg_2025');
    DELETE FROM curriculum_documents WHERE class_id=ukg_class_id AND checksum='demo_checksum_ukg_2025';
  END IF;

  -- 7. section then class (now safe — no students reference them)
  IF ukg_section_id IS NOT NULL THEN
    DELETE FROM sections WHERE id=ukg_section_id;
  END IF;
  IF ukg_class_id IS NOT NULL THEN
    DELETE FROM classes WHERE id=ukg_class_id;
  END IF;
END $$;

-- ── 1. ROLES ─────────────────────────────────────────────────
INSERT INTO roles (school_id, name, permissions)
VALUES
  ('a0000000-0000-0000-0000-000000000001','admin','["all"]'),
  ('a0000000-0000-0000-0000-000000000001','principal','["view_reports","view_teachers","view_coverage"]'),
  ('a0000000-0000-0000-0000-000000000001','teacher','["manage_class","submit_completion","send_homework"]')
ON CONFLICT (school_id, name) DO NOTHING;

-- ── 2. STAFF USERS ───────────────────────────────────────────
-- Admin
INSERT INTO users (school_id, role_id, name, email, mobile, password_hash, is_active, force_password_reset)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  r.id,
  'Sunita Rao',
  'admin.demo@oakit.in',
  '9800000001',
  crypt('9800000001', gen_salt('bf',10)),
  true, false
FROM roles r
WHERE r.school_id='a0000000-0000-0000-0000-000000000001' AND r.name='admin'
ON CONFLICT (email) DO UPDATE SET mobile='9800000001',
  password_hash=crypt('9800000001', gen_salt('bf',10)), force_password_reset=false;

-- Principal
INSERT INTO users (school_id, role_id, name, email, mobile, password_hash, is_active, force_password_reset)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  r.id,
  'Dr. Meera Pillai',
  'principal.demo@oakit.in',
  '9800000002',
  crypt('9800000002', gen_salt('bf',10)),
  true, false
FROM roles r
WHERE r.school_id='a0000000-0000-0000-0000-000000000001' AND r.name='principal'
ON CONFLICT (email) DO UPDATE SET mobile='9800000002',
  password_hash=crypt('9800000002', gen_salt('bf',10)), force_password_reset=false;

-- Teacher
INSERT INTO users (school_id, role_id, name, email, mobile, password_hash, is_active, force_password_reset)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  r.id,
  'Kavitha Nair',
  'teacher.demo@oakit.in',
  '9800000003',
  crypt('9800000003', gen_salt('bf',10)),
  true, false
FROM roles r
WHERE r.school_id='a0000000-0000-0000-0000-000000000001' AND r.name='teacher'
ON CONFLICT (email) DO UPDATE SET mobile='9800000003',
  password_hash=crypt('9800000003', gen_salt('bf',10)), force_password_reset=false;

-- ── 3. CLASS + SECTION ───────────────────────────────────────
INSERT INTO classes (school_id, name)
VALUES ('a0000000-0000-0000-0000-000000000001','UKG')
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO sections (school_id, class_id, label, class_teacher_id)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  c.id,
  'A',
  u.id
FROM classes c, users u
WHERE c.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG'
  AND u.school_id='a0000000-0000-0000-0000-000000000001' AND u.mobile='9800000003'
ON CONFLICT (class_id, label) DO UPDATE SET class_teacher_id=EXCLUDED.class_teacher_id;

-- Assign teacher to section
INSERT INTO teacher_sections (teacher_id, section_id)
SELECT u.id, s.id
FROM users u, sections s
JOIN classes c ON c.id=s.class_id
WHERE u.school_id='a0000000-0000-0000-0000-000000000001' AND u.mobile='9800000003'
  AND c.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG' AND s.label='A'
ON CONFLICT DO NOTHING;

-- ── 4. STUDENTS ──────────────────────────────────────────────
INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, is_active)
SELECT
  'a0000000-0000-0000-0000-000000000001', c.id, s.id,
  v.name, v.father, v.mother, v.contact, true
FROM classes c
JOIN sections s ON s.class_id=c.id AND s.label='A'
CROSS JOIN (VALUES
  ('Aarav Kapoor',   'Rajesh Kapoor',  'Priya Kapoor',  '9800000004'),
  ('Priya Nair',     'Suresh Nair',    'Deepa Nair',    '9800000005'),
  ('Rohan Mehta',    'Amit Mehta',     'Sunita Mehta',  '9800000005'),
  ('Ananya Singh',   'Vikram Singh',   'Pooja Singh',   '9800100006'),
  ('Dev Patel',      'Nikhil Patel',   'Ritu Patel',    '9800100007'),
  ('Sia Sharma',     'Arun Sharma',    'Neha Sharma',   '9800100008')
) AS v(name, father, mother, contact)
WHERE c.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG';

-- ── 5. PARENT USERS + LINKS ──────────────────────────────────
-- Parent 1: Rajesh Kapoor — father of Aarav
INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '9800000004', 'Rajesh Kapoor',
  crypt('9800000004', gen_salt('bf',10)), false, true
) ON CONFLICT (school_id, mobile) DO UPDATE
  SET password_hash=crypt('9800000004', gen_salt('bf',10)), force_password_reset=false;

-- Parent 2: Suresh Nair — father of Priya AND Rohan (multi-child demo)
INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '9800000005', 'Suresh Nair',
  crypt('9800000005', gen_salt('bf',10)), false, true
) ON CONFLICT (school_id, mobile) DO UPDATE
  SET password_hash=crypt('9800000005', gen_salt('bf',10)), force_password_reset=false;

-- Link parents to students
INSERT INTO parent_student_links (parent_id, student_id)
SELECT pu.id, st.id
FROM parent_users pu, students st
WHERE pu.school_id='a0000000-0000-0000-0000-000000000001'
  AND st.school_id='a0000000-0000-0000-0000-000000000001'
  AND (
    (pu.mobile='9800000004' AND st.name='Aarav Kapoor') OR
    (pu.mobile='9800000005' AND st.name='Priya Nair')   OR
    (pu.mobile='9800000005' AND st.name='Rohan Mehta')
  )
ON CONFLICT DO NOTHING;

-- ── 6. SCHOOL CALENDAR ───────────────────────────────────────
INSERT INTO school_calendar (school_id, academic_year, working_days, start_date, end_date, holidays)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '2025-2026',
  ARRAY[1,2,3,4,5],
  '2025-06-01',
  '2026-03-31',
  ARRAY['2025-08-15','2025-10-02','2025-11-01','2025-12-25','2026-01-26','2026-03-14']::DATE[]
) ON CONFLICT (school_id, academic_year) DO UPDATE
  SET working_days=EXCLUDED.working_days, start_date=EXCLUDED.start_date,
      end_date=EXCLUDED.end_date, holidays=EXCLUDED.holidays;

-- ── 7. CURRICULUM CHUNKS (UKG — 2 weeks of content) ─────────
DO $$
DECLARE
  sid  UUID := 'a0000000-0000-0000-0000-000000000001';
  cid  UUID;
  docid UUID;
  teacherid UUID;
BEGIN
  SELECT id INTO cid  FROM classes WHERE school_id=sid AND name='UKG';
  SELECT id INTO teacherid FROM users WHERE school_id=sid AND mobile='9800000003';

  -- Create a demo curriculum document
  INSERT INTO curriculum_documents (school_id, class_id, filename, file_path, checksum, status, total_chunks, uploaded_by)
  VALUES (sid, cid, 'UKG_Demo_Curriculum.pdf', '/demo/ukg_curriculum.pdf',
          'demo_checksum_ukg_2025', 'processed', 10, teacherid)
  ON CONFLICT (class_id, checksum) DO NOTHING
  RETURNING id INTO docid;

  IF docid IS NULL THEN
    SELECT id INTO docid FROM curriculum_documents WHERE class_id=cid AND checksum='demo_checksum_ukg_2025';
  END IF;

  -- Delete old chunks for this doc
  DELETE FROM curriculum_chunks WHERE document_id=docid;

  -- Insert 10 rich curriculum chunks
  INSERT INTO curriculum_chunks (school_id, document_id, class_id, chunk_index, topic_label, content, page_start, page_end)
  VALUES
  (sid, docid, cid, 0, 'Circle Time / Morning Meet',
   'Circle Time: Welcome children warmly. Begin with a morning prayer together. Ask each child to share one happy thought.
Ask children: What are you looking forward to today?
What to do: Sit in a circle, use a talking object (soft toy), each child gets 20 seconds.
Tip: Keep it to 10 minutes. Start with a clap rhythm to settle the group.',
   1, 1),

  (sid, docid, cid, 1, 'English Speaking — My Family',
   'English Speaking: Talk about family members using simple sentences.
Objective: Build confidence in spoken English. Introduce vocabulary: mother, father, sister, brother, grandmother.
What to do: Show a picture of a family. Ask "Who is this?" Model the sentence "This is my mother." Children repeat.
Ask children: Can you tell me one thing your mother does at home?
Resources: Family picture cards, talking stick.',
   2, 2),

  (sid, docid, cid, 2, 'English — Letter Aa and Bb',
   'English: Introduce letters Aa and Bb with phonics sounds.
Objective: Recognise and write letters A and B. Say the phonics sound /a/ and /b/.
What to do: Write A and B on the board. Say the sound 3 times together. Children air-trace, then write in books.
Ask children: Can you find something in the classroom that starts with A?
Resources: Alphabet chart, pencils, lined notebook.',
   3, 3),

  (sid, docid, cid, 3, 'Math — Numbers 1 to 10',
   'Math: Count and recognise numbers 1 to 10 using objects.
Objective: Count objects up to 10. Write numbers 1-5 correctly.
What to do: Place 10 blocks on the table. Count together. Ask a child to pick up 7 blocks.
Ask children: Can you show me 5 fingers? What number comes after 6?
Resources: Counting blocks, number flashcards, number line on board.',
   4, 4),

  (sid, docid, cid, 4, 'GK — Animals and Their Sounds',
   'General Knowledge: Learn about common animals and the sounds they make.
Objective: Name 5 animals. Match animal to its sound.
What to do: Show animal flashcards one by one. Make the sound together. Ask children to act like the animal.
Ask children: Which animal says moo? Can you walk like an elephant?
Resources: Animal flashcards, animal sound chart.',
   5, 5),

  (sid, docid, cid, 5, 'Writing — Tracing Letters A and B',
   'Writing: Trace and copy letters A and B in the notebook.
Objective: Develop fine motor skills. Correct pencil grip (3-finger grip).
What to do: Check pencil grip before starting. Demonstrate on board. Children trace dotted letters, then copy independently.
Tip: Use triangular pencil grip aids if needed. Praise neatness and effort equally.
Resources: Tracing worksheet, pencils.',
   6, 6),

  (sid, docid, cid, 6, 'Art — Drawing My Family',
   'Art: Draw a picture of your family.
Objective: Express creativity. Practise drawing people.
What to do: Show a simple stick-figure family. Children draw their own family. Label with names if able.
Ask children: How many people are in your family? What colour is your mother''s dress?
Resources: Drawing paper, crayons, colour pencils.',
   7, 7),

  (sid, docid, cid, 7, 'Circle Time / Morning Meet',
   'Circle Time: Welcome children warmly. Begin with a morning prayer together. Ask each child to share one happy thought.
Ask children: What are you looking forward to today?
What to do: Sit in a circle, use a talking object (soft toy), each child gets 20 seconds.
Tip: Keep it to 10 minutes. Start with a clap rhythm to settle the group.',
   1, 1),

  (sid, docid, cid, 8, 'English Speaking — Colours',
   'English Speaking: Name and describe colours in the classroom.
Objective: Use colour words in sentences. Build vocabulary: red, blue, green, yellow, orange.
What to do: Hold up coloured objects. Ask "What colour is this?" Model "This is a red ball." Children repeat.
Ask children: Can you find something blue in the classroom? What is your favourite colour?
Resources: Coloured objects, colour flashcards.',
   8, 8),

  (sid, docid, cid, 9, 'Math — Shapes: Circle, Square, Triangle',
   'Math: Identify and draw basic shapes — circle, square, triangle.
Objective: Name 3 shapes. Find shapes in the classroom.
What to do: Draw each shape on the board. Children air-trace. Find shapes in the room (clock=circle, window=square).
Ask children: How many sides does a triangle have? Can you find a circle in the classroom?
Resources: Shape flashcards, drawing paper.',
   9, 9);

END $$;

-- ── 8. DAY PLANS (last 5 days + today + tomorrow) ────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  chunk_ids UUID[];
  d         DATE;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';

  -- Get first 5 chunk IDs (day 1 set)
  SELECT ARRAY_AGG(id ORDER BY chunk_index) INTO chunk_ids
  FROM curriculum_chunks WHERE class_id=cid AND chunk_index BETWEEN 0 AND 4;

  -- Plans for last 5 working days
  FOR i IN 1..5 LOOP
    d := CURRENT_DATE - i;
    -- skip weekends
    WHILE EXTRACT(DOW FROM d) IN (0,6) LOOP d := d - 1; END LOOP;
    INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
    VALUES (sid, sec_id, teacherid, d, chunk_ids, 'scheduled')
    ON CONFLICT (section_id, plan_date) DO UPDATE SET chunk_ids=EXCLUDED.chunk_ids;
  END LOOP;

  -- Today's plan (chunks 0-4)
  INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
  VALUES (sid, sec_id, teacherid, CURRENT_DATE, chunk_ids, 'scheduled')
  ON CONFLICT (section_id, plan_date) DO UPDATE SET chunk_ids=EXCLUDED.chunk_ids;

  -- Tomorrow's plan (chunks 5-9)
  SELECT ARRAY_AGG(id ORDER BY chunk_index) INTO chunk_ids
  FROM curriculum_chunks WHERE class_id=cid AND chunk_index BETWEEN 5 AND 9;

  d := CURRENT_DATE + 1;
  WHILE EXTRACT(DOW FROM d) IN (0,6) LOOP d := d + 1; END LOOP;
  INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
  VALUES (sid, sec_id, teacherid, d, chunk_ids, 'scheduled')
  ON CONFLICT (section_id, plan_date) DO UPDATE SET chunk_ids=EXCLUDED.chunk_ids;

END $$;

-- ── 9. DAILY COMPLETIONS (last 4 days — today NOT completed) ─
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  chunk_ids UUID[];
  d         DATE;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';

  SELECT ARRAY_AGG(id ORDER BY chunk_index) INTO chunk_ids
  FROM curriculum_chunks WHERE class_id=cid AND chunk_index BETWEEN 0 AND 4;

  FOR i IN 1..4 LOOP
    d := CURRENT_DATE - i;
    WHILE EXTRACT(DOW FROM d) IN (0,6) LOOP d := d - 1; END LOOP;
    INSERT INTO daily_completions (school_id, section_id, teacher_id, completion_date, covered_chunk_ids)
    VALUES (sid, sec_id, teacherid, d, chunk_ids)
    ON CONFLICT (section_id, completion_date) DO UPDATE SET covered_chunk_ids=EXCLUDED.covered_chunk_ids;
  END LOOP;
END $$;

-- ── 10. ATTENDANCE (last 10 days) ────────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  d         DATE;
  st        RECORD;
  att_status TEXT;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';

  FOR i IN 1..10 LOOP
    d := CURRENT_DATE - i;
    WHILE EXTRACT(DOW FROM d) IN (0,6) LOOP d := d - 1; END LOOP;

    FOR st IN SELECT id, name FROM students WHERE section_id=sec_id LOOP
      -- Priya Nair absent on day 2 and 5 (shows absence history in parent portal)
      IF st.name='Priya Nair' AND i IN (2,5) THEN
        att_status := 'absent';
      ELSE
        att_status := 'present';
      END IF;

      INSERT INTO attendance_records (school_id, section_id, student_id, teacher_id, attend_date, status)
      VALUES (sid, sec_id, st.id, teacherid, d, att_status)
      ON CONFLICT (section_id, student_id, attend_date) DO UPDATE SET status=EXCLUDED.status;
    END LOOP;
  END LOOP;
END $$;

-- ── 11. TEACHER STREAK ───────────────────────────────────────
INSERT INTO teacher_streaks (teacher_id, school_id, current_streak, best_streak, last_completed_date)
SELECT u.id, 'a0000000-0000-0000-0000-000000000001', 7, 12, CURRENT_DATE - 1
FROM users u
WHERE u.school_id='a0000000-0000-0000-0000-000000000001' AND u.mobile='9800000003'
ON CONFLICT (teacher_id, school_id) DO UPDATE
  SET current_streak=7, best_streak=12, last_completed_date=CURRENT_DATE-1;

-- ── 12. HOMEWORK + NOTES (today) ─────────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';

  -- Today's homework
  INSERT INTO teacher_homework (school_id, section_id, teacher_id, homework_date, raw_text, formatted_text)
  VALUES (
    sid, sec_id, teacherid, CURRENT_DATE,
    'Practice writing letters A and B. Count 10 objects at home. Draw your family.',
    E'Homework for today:\n\n1. Practice writing letters A and B in your notebook — 2 lines each\n2. Find 10 objects at home and count them out loud with a parent\n3. Draw a picture of your family and colour it\n\nThis reinforces what we learned about letters and numbers today. Great work, little stars! ⭐'
  ) ON CONFLICT (section_id, homework_date) DO UPDATE
    SET raw_text=EXCLUDED.raw_text, formatted_text=EXCLUDED.formatted_text;

  -- Today's class note
  INSERT INTO teacher_notes (school_id, section_id, teacher_id, note_date, note_text, expires_at)
  VALUES (
    sid, sec_id, teacherid, CURRENT_DATE,
    E'Dear Parents,\n\nWe had a wonderful day today! The children were very enthusiastic during Circle Time and loved the animal sounds activity in GK.\n\nReminder: Tomorrow we will be doing an Art activity — please send an old shirt or apron to protect their uniform.\n\nThank you for your continued support!\n\nWarm regards,\nMs. Kavitha',
    now() + INTERVAL '14 days'
  );

END $$;

-- ── 13. HOMEWORK SUBMISSIONS (yesterday — shows tracking) ────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  yesterday DATE;
  st        RECORD;
  hw_status TEXT;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';
  yesterday := CURRENT_DATE - 1;
  WHILE EXTRACT(DOW FROM yesterday) IN (0,6) LOOP yesterday := yesterday - 1; END LOOP;

  -- Insert yesterday's homework record first
  INSERT INTO teacher_homework (school_id, section_id, teacher_id, homework_date, raw_text, formatted_text)
  VALUES (
    sid, sec_id, teacherid, yesterday,
    'Revise numbers 1-5. Colour the shapes worksheet.',
    E'Homework for yesterday:\n\n1. Revise numbers 1 to 5 — write each number 3 times\n2. Colour the shapes worksheet (circle=red, square=blue, triangle=green)\n\nKeep up the great work! 🌟'
  ) ON CONFLICT (section_id, homework_date) DO UPDATE
    SET raw_text=EXCLUDED.raw_text, formatted_text=EXCLUDED.formatted_text;

  FOR st IN SELECT id, name FROM students WHERE section_id=sec_id LOOP
    IF st.name IN ('Aarav Kapoor','Ananya Singh','Dev Patel') THEN
      hw_status := 'completed';
    ELSIF st.name IN ('Rohan Mehta','Sia Sharma') THEN
      hw_status := 'partial';
    ELSE
      hw_status := 'not_submitted';
    END IF;

    INSERT INTO homework_submissions (school_id, section_id, student_id, homework_date, status, recorded_by)
    VALUES (sid, sec_id, st.id, yesterday, hw_status, teacherid)
    ON CONFLICT (student_id, homework_date) DO UPDATE SET status=EXCLUDED.status;
  END LOOP;
END $$;

-- ── 14. CHILD JOURNEY ENTRIES ────────────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  aarav_id  UUID;
  priya_id  UUID;
  rohan_id  UUID;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';
  SELECT id INTO aarav_id  FROM students WHERE section_id=sec_id AND name='Aarav Kapoor';
  SELECT id INTO priya_id  FROM students WHERE section_id=sec_id AND name='Priya Nair';
  SELECT id INTO rohan_id  FROM students WHERE section_id=sec_id AND name='Rohan Mehta';

  -- Aarav — daily highlight (today)
  INSERT INTO child_journey_entries
    (school_id, student_id, section_id, teacher_id, entry_date, entry_type, raw_text, beautified_text, is_sent_to_parent, sent_at)
  VALUES (
    sid, aarav_id, sec_id, teacherid, CURRENT_DATE, 'highlight',
    'Aarav surprised everyone by reciting the full alphabet song without any help today!',
    E'What a proud moment today! Aarav stood up during Circle Time and recited the entire alphabet song completely on his own — without any prompting from the teacher. The whole class cheered for him! His confidence is growing beautifully, and his enthusiasm for learning is truly infectious. We are so proud of you, Aarav! 🌟',
    true, now()
  ) ON CONFLICT (student_id, entry_date, entry_type) DO UPDATE
    SET beautified_text=EXCLUDED.beautified_text;

  -- Priya — daily entry (yesterday)
  INSERT INTO child_journey_entries
    (school_id, student_id, section_id, teacher_id, entry_date, entry_type, raw_text, beautified_text, is_sent_to_parent, sent_at)
  VALUES (
    sid, priya_id, sec_id, teacherid, CURRENT_DATE - 1, 'daily',
    'Priya was very focused during math today. She helped a friend count the blocks.',
    E'Priya had a wonderful day in class today! During our Math activity, she was completely focused and counted all 10 blocks correctly. What made it extra special was that she noticed her friend was struggling and quietly helped them — showing such kindness and empathy. Priya is not just growing academically but also as a caring little person. We love having her in class! 💚',
    true, now() - INTERVAL '1 day'
  ) ON CONFLICT (student_id, entry_date, entry_type) DO UPDATE
    SET beautified_text=EXCLUDED.beautified_text;

  -- Rohan — weekly summary
  INSERT INTO child_journey_entries
    (school_id, student_id, section_id, teacher_id, entry_date, entry_type, raw_text, beautified_text, is_sent_to_parent, sent_at)
  VALUES (
    sid, rohan_id, sec_id, teacherid, CURRENT_DATE - 2, 'weekly',
    'Rohan had a great week. Improved a lot in English speaking. More confident now.',
    E'This has been a fantastic week for Rohan! We have seen remarkable improvement in his English speaking — he is raising his hand more often, forming complete sentences, and speaking with growing confidence. At the start of the week he was hesitant, but by Friday he was one of the first to volunteer during our speaking activity. This kind of progress is truly exciting to witness. Keep encouraging him at home — he is on a wonderful journey! 📚',
    true, now() - INTERVAL '2 days'
  ) ON CONFLICT (student_id, entry_date, entry_type) DO UPDATE
    SET beautified_text=EXCLUDED.beautified_text;

END $$;

-- ── 15. STUDENT OBSERVATIONS ─────────────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  aarav_id  UUID;
  priya_id  UUID;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';
  SELECT id INTO aarav_id  FROM students WHERE section_id=sec_id AND name='Aarav Kapoor';
  SELECT id INTO priya_id  FROM students WHERE section_id=sec_id AND name='Priya Nair';

  INSERT INTO student_observations (student_id, teacher_id, school_id, obs_text, categories, share_with_parent, obs_date)
  VALUES
  (aarav_id, teacherid, sid,
   'Aarav shows excellent number recognition. Counted to 20 independently today. Recommend introducing addition concepts next week.',
   ARRAY['academic','math'], true, CURRENT_DATE),
  (priya_id, teacherid, sid,
   'Priya was absent for 2 days this week. On return she was a bit quiet but settled well by afternoon. Parents informed.',
   ARRAY['attendance','wellbeing'], true, CURRENT_DATE - 1);
END $$;

-- ── 16. MESSAGES (teacher ↔ parent) ──────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  teacherid UUID;
  cid       UUID;
  parent1   UUID;
  aarav_id  UUID;
BEGIN
  SELECT id INTO cid       FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id    FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO teacherid FROM users    WHERE school_id=sid AND mobile='9800000003';
  SELECT id INTO parent1   FROM parent_users WHERE school_id=sid AND mobile='9800000004';
  SELECT id INTO aarav_id  FROM students WHERE section_id=sec_id AND name='Aarav Kapoor';

  INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body, sent_at)
  VALUES
  (sid, teacherid, parent1, aarav_id, 'teacher',
   'Hello! Just wanted to share that Aarav has been doing wonderfully this week. He recited the alphabet song today completely on his own — a big milestone! Please keep encouraging him at home. 😊',
   now() - INTERVAL '2 hours'),
  (sid, teacherid, parent1, aarav_id, 'parent',
   'Thank you so much Ms. Kavitha! We are so happy to hear this. We have been practising every evening. He loves school!',
   now() - INTERVAL '1 hour'),
  (sid, teacherid, parent1, aarav_id, 'teacher',
   'That is wonderful to hear! The home practice really shows. Tomorrow we start shapes — you can look for circles and squares at home to get him excited!',
   now() - INTERVAL '30 minutes');
END $$;

-- ── 17. ANNOUNCEMENTS ────────────────────────────────────────
DO $$
DECLARE
  sid      UUID := 'a0000000-0000-0000-0000-000000000001';
  adminid  UUID;
  cid      UUID;
BEGIN
  SELECT id INTO adminid FROM users WHERE school_id=sid AND mobile='9800000001';
  SELECT id INTO cid     FROM classes WHERE school_id=sid AND name='UKG';

  INSERT INTO announcements (school_id, author_id, title, body, target_audience, target_class_id, expires_at)
  VALUES
  (sid, adminid,
   'Annual Sports Day — 15 November 2025',
   'Dear Parents and Staff, we are excited to announce our Annual Sports Day on 15th November 2025. All students should wear their sports uniform. Parents are warmly invited to attend. More details will follow. Let us make it a memorable day for our little champions!',
   'all', NULL, now() + INTERVAL '30 days'),
  (sid, adminid,
   'UKG Art Activity Tomorrow — Please Send Apron',
   'Dear UKG Parents, tomorrow we have a special Art activity. Please send an old shirt or apron with your child to protect their uniform. Paints and materials will be provided by the school.',
   'class', cid, now() + INTERVAL '2 days'),
  (sid, adminid,
   'Parent-Teacher Meeting — 20 November 2025',
   'We invite all parents to our Parent-Teacher Meeting on 20th November 2025 from 9 AM to 12 PM. This is a great opportunity to discuss your child''s progress. Please confirm your slot via the school office.',
   'parents', NULL, now() + INTERVAL '45 days');
END $$;

-- ── 18. PARENT NOTIFICATIONS ─────────────────────────────────
DO $$
DECLARE
  sid       UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id    UUID;
  cid       UUID;
  comp_id   UUID;
  parent1   UUID;
  parent2   UUID;
BEGIN
  SELECT id INTO cid     FROM classes WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id  FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO parent1 FROM parent_users WHERE school_id=sid AND mobile='9800000004';
  SELECT id INTO parent2 FROM parent_users WHERE school_id=sid AND mobile='9800000005';

  -- Get yesterday's completion
  SELECT id INTO comp_id FROM daily_completions
  WHERE section_id=sec_id AND completion_date=CURRENT_DATE-1 LIMIT 1;

  IF comp_id IS NOT NULL THEN
    INSERT INTO parent_notifications (parent_id, completion_id, section_id, completion_date, chunks_covered, is_read)
    VALUES
    (parent1, comp_id, sec_id, CURRENT_DATE-1, 5, false),
    (parent2, comp_id, sec_id, CURRENT_DATE-1, 5, false)
    ON CONFLICT (parent_id, completion_id) DO NOTHING;
  END IF;
END $$;

-- ── 19. SCHOOL SETTINGS ──────────────────────────────────────
INSERT INTO school_settings (school_id, notes_expiry_days)
VALUES ('a0000000-0000-0000-0000-000000000001', 14)
ON CONFLICT (school_id) DO UPDATE SET notes_expiry_days=14;

-- ── 20. VERIFY ───────────────────────────────────────────────
SELECT 'STAFF' as type, mobile, name, r.name as role
FROM users u JOIN roles r ON r.id=u.role_id
WHERE u.school_id='a0000000-0000-0000-0000-000000000001'
  AND u.mobile IN ('9800000001','9800000002','9800000003')
UNION ALL
SELECT 'PARENT', mobile, name, 'parent'
FROM parent_users
WHERE school_id='a0000000-0000-0000-0000-000000000001'
  AND mobile IN ('9800000004','9800000005')
ORDER BY type, mobile;

SELECT 'STUDENT: ' || s.name || ' | Section: UKG-A | Parent contact: ' || COALESCE(s.parent_contact,'—') as info
FROM students s
JOIN sections sec ON sec.id=s.section_id
JOIN classes c ON c.id=sec.class_id
WHERE s.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG'
ORDER BY s.name;

SELECT 'CHUNKS: ' || COUNT(*) || ' curriculum chunks loaded for UKG' as info
FROM curriculum_chunks cc JOIN classes c ON c.id=cc.class_id
WHERE c.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG';

SELECT 'PLANS: ' || COUNT(*) || ' day plans created' as info
FROM day_plans dp JOIN sections s ON s.id=dp.section_id
JOIN classes c ON c.id=s.class_id
WHERE dp.school_id='a0000000-0000-0000-0000-000000000001' AND c.name='UKG';
