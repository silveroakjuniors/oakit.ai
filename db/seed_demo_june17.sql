-- ============================================================
-- OAKIT DEMO SEED — June 17, 2026
-- School is running well. UKG class only.
-- Time machine date: 2026-06-17
-- ============================================================
-- SCENARIO:
--   • School has been running since June 1
--   • June 1–15: All topics covered, attendance excellent
--   • June 16 (yesterday): UKG teacher Kavitha covered only 3/5 topics
--     → 2 topics carry forward to June 17
--   • June 17 (today): Plan loaded, attendance not yet marked
--   • 2 students absent on June 16 (Priya Nair, Rohan Mehta)
--   • Principal views coverage report up to June 15 — looks great
--   • Birthdays: Aarav Kapoor birthday = June 17 (today!)
-- ============================================================

-- ── 0. ACTIVATE TIME MACHINE to June 17 ──────────────────────
-- (Do this via Admin → Time Machine in the UI, OR run:)
-- INSERT INTO time_machine (school_id, mock_date, expires_at)
-- VALUES ('a0000000-0000-0000-0000-000000000001', '2026-06-17', now() + INTERVAL '48 hours')
-- ON CONFLICT (school_id) DO UPDATE SET mock_date='2026-06-17', expires_at=now()+INTERVAL '48 hours';

-- ── 1. ENSURE MIGRATION 045 IS RUN ───────────────────────────
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
CREATE INDEX IF NOT EXISTS idx_students_dob ON students(date_of_birth);

-- ── 2. SET BIRTHDAYS ─────────────────────────────────────────
-- Demo date = June 17. Birthday widget checks month+day match.
-- Priya Nair + Rohan Mehta: birthday June 17 (TODAY in demo — 🎂 Today!)
UPDATE students SET date_of_birth = '2021-06-17'
WHERE name = 'Priya Nair'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students SET date_of_birth = '2021-06-17'
WHERE name = 'Rohan Mehta'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Aarav Kapoor: birthday June 16 (yesterday — shows in upcoming list as "in 0d" / recent)
-- Actually set to June 20 so it shows "in 3 days" — gives variety in the widget
UPDATE students SET date_of_birth = '2021-06-20'
WHERE name = 'Aarav Kapoor'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Others: outside 7-day window from June 17
UPDATE students SET date_of_birth = '2021-08-05' WHERE name = 'Ananya Singh'  AND school_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE students SET date_of_birth = '2021-11-22' WHERE name = 'Dev Patel'     AND school_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE students SET date_of_birth = '2021-09-14' WHERE name = 'Sia Sharma'    AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- ── 3. CLEAN PREVIOUS DEMO DATA (June range) ─────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  IF sec_id IS NULL THEN RAISE NOTICE 'UKG-A not found'; RETURN; END IF;

  DELETE FROM daily_completions  WHERE section_id=sec_id AND completion_date BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM day_plans          WHERE section_id=sec_id AND plan_date        BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM attendance_records WHERE section_id=sec_id AND attend_date      BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM teacher_homework   WHERE section_id=sec_id AND homework_date    BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM teacher_notes      WHERE section_id=sec_id AND note_date        BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM homework_submissions WHERE section_id=sec_id AND homework_date  BETWEEN '2026-06-01' AND '2026-06-17';
  DELETE FROM child_journey_entries WHERE section_id=sec_id AND entry_date    BETWEEN '2026-06-01' AND '2026-06-17';
END $$;

-- ── 4. CURRICULUM CHUNKS (ensure 10 exist for UKG) ───────────
-- (Already seeded by seed_demo_investor.sql — skip if chunks exist)

-- ── 5. DAY PLANS: June 2–17 — each day gets Circle Time + 2 rotating subjects ─
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  d      DATE;
  day_num   INT := 0;
  all_ids   UUID[];
  n_chunks  INT;
  i1        INT;
  i2        INT;
  i3        INT;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  -- all chunks ordered by index
  SELECT ARRAY_AGG(id ORDER BY chunk_index) INTO all_ids
  FROM curriculum_chunks WHERE class_id=cid;

  IF all_ids IS NULL OR array_length(all_ids,1) < 3 THEN
    RAISE NOTICE 'Not enough chunks'; RETURN;
  END IF;

  n_chunks := array_length(all_ids, 1);

  FOR d IN SELECT generate_series('2026-06-02'::date,'2026-06-17'::date,'1 day'::interval)::date LOOP
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;

    -- 3 consecutive non-overlapping chunks per day, rotating through all chunks
    i1 := (day_num * 3) % n_chunks + 1;
    i2 := (day_num * 3 + 1) % n_chunks + 1;
    i3 := (day_num * 3 + 2) % n_chunks + 1;
    day_num := day_num + 1;

    INSERT INTO day_plans (school_id,section_id,teacher_id,plan_date,chunk_ids,status)
    VALUES (sid, sec_id, tid, d, ARRAY[all_ids[i1], all_ids[i2], all_ids[i3]], 'scheduled')
    ON CONFLICT (section_id,plan_date) DO UPDATE SET chunk_ids=EXCLUDED.chunk_ids;
  END LOOP;
END $$;

-- ── 6. COMPLETIONS: June 2–15 (all complete, excellent) ──────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  d      DATE;
  plan_row RECORD;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  FOR d IN SELECT generate_series('2026-06-02'::date, '2026-06-15'::date, '1 day'::interval)::date LOOP
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;

    SELECT chunk_ids INTO plan_row FROM day_plans WHERE section_id=sec_id AND plan_date=d;
    IF plan_row IS NULL THEN CONTINUE; END IF;

    INSERT INTO daily_completions (school_id, section_id, teacher_id, completion_date, covered_chunk_ids)
    VALUES (sid, sec_id, tid, d, plan_row.chunk_ids)
    ON CONFLICT (section_id, completion_date) DO UPDATE SET covered_chunk_ids=EXCLUDED.covered_chunk_ids;
  END LOOP;
END $$;

-- ── 7. JUNE 16 (YESTERDAY): Partial completion ───────────────
-- Teacher covered only 3 of 5 topics — 2 carry forward to June 17
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  all_chunks UUID[];
  partial_chunks UUID[];
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  SELECT chunk_ids INTO all_chunks FROM day_plans WHERE section_id=sec_id AND plan_date='2026-06-16';
  IF all_chunks IS NULL THEN RETURN; END IF;

  -- Cover only first 2 chunks (Circle Time + 1 subject), leave last subject pending → carry forward
  partial_chunks := all_chunks[1:2];

  INSERT INTO daily_completions (school_id, section_id, teacher_id, completion_date, covered_chunk_ids)
  VALUES (sid, sec_id, tid, '2026-06-16', partial_chunks)
  ON CONFLICT (section_id, completion_date) DO UPDATE SET covered_chunk_ids=EXCLUDED.covered_chunk_ids;
END $$;

-- ── 8. ATTENDANCE: June 2–16 ─────────────────────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  d      DATE;
  st     RECORD;
  att    TEXT;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  FOR d IN SELECT generate_series('2026-06-02'::date, '2026-06-16'::date, '1 day'::interval)::date LOOP
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;

    FOR st IN SELECT id, name FROM students WHERE section_id=sec_id AND is_active=true LOOP
      -- Priya Nair and Rohan Mehta absent on June 16 only
      IF st.name IN ('Priya Nair','Rohan Mehta') AND d = '2026-06-16' THEN
        att := 'absent';
      -- Ananya Singh absent on June 9 (one earlier absence)
      ELSIF st.name = 'Ananya Singh' AND d = '2026-06-09' THEN
        att := 'absent';
      ELSE
        att := 'present';
      END IF;

      INSERT INTO attendance_records (school_id, section_id, student_id, teacher_id, attend_date, status)
      VALUES (sid, sec_id, st.id, tid, d, att)
      ON CONFLICT (section_id, student_id, attend_date) DO UPDATE SET status=EXCLUDED.status;
    END LOOP;
  END LOOP;
END $$;

-- ── 9. HOMEWORK: June 2–16 ───────────────────────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  d      DATE;
  hw_texts TEXT[][] := ARRAY[
    ARRAY['Practice writing letters A and B. Count 10 objects at home.',
          E'Homework for today:\n1. Practice writing letters A and B — 2 lines each\n2. Count 10 objects at home and write them down\n\nKeep up the great work! ⭐'],
    ARRAY['Revise numbers 1-5. Colour the shapes worksheet.',
          E'Homework for today:\n1. Revise numbers 1 to 5 — write each number 3 times\n2. Colour the shapes worksheet (circle=red, square=blue, triangle=green)\n\nWonderful effort today! 🌟'],
    ARRAY['Read the story on page 12 with parents. Draw your favourite animal.',
          E'Homework for today:\n1. Read the story on page 12 with a parent\n2. Draw your favourite animal and colour it\n\nHappy reading! 📚'],
    ARRAY['Practice saying the days of the week. Bring a leaf from home.',
          E'Homework for today:\n1. Practice saying the days of the week with a parent\n2. Bring one leaf from home tomorrow for our nature activity\n\nGreat learning today! 🍃'],
    ARRAY['Write numbers 1-10. Find 5 things that are round at home.',
          E'Homework for today:\n1. Write numbers 1 to 10 neatly in your notebook\n2. Find 5 round things at home and tell a parent their names\n\nExcellent work today! 🔢']
  ];
  hw_idx INT := 0;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  FOR d IN SELECT generate_series('2026-06-02'::date, '2026-06-16'::date, '1 day'::interval)::date LOOP
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;
    hw_idx := (hw_idx % 5) + 1;

    INSERT INTO teacher_homework (school_id, section_id, teacher_id, homework_date, raw_text, formatted_text)
    VALUES (sid, sec_id, tid, d, hw_texts[hw_idx][1], hw_texts[hw_idx][2])
    ON CONFLICT (section_id, homework_date) DO UPDATE
      SET raw_text=EXCLUDED.raw_text, formatted_text=EXCLUDED.formatted_text;
  END LOOP;
END $$;

-- ── 10. HOMEWORK SUBMISSIONS: June 15 & 16 ───────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  st     RECORD;
  hw_status TEXT;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';

  -- June 15: mostly completed
  FOR st IN SELECT id, name FROM students WHERE section_id=sec_id AND is_active=true LOOP
    hw_status := CASE
      WHEN st.name IN ('Aarav Kapoor','Ananya Singh','Dev Patel','Sia Sharma') THEN 'completed'
      WHEN st.name = 'Rohan Mehta' THEN 'partial'
      ELSE 'not_submitted'
    END;
    INSERT INTO homework_submissions (school_id, section_id, student_id, homework_date, status, recorded_by)
    VALUES (sid, sec_id, st.id, '2026-06-15', hw_status, tid)
    ON CONFLICT (student_id, homework_date) DO UPDATE SET status=EXCLUDED.status;
  END LOOP;

  -- June 16: Priya and Rohan absent so not submitted
  FOR st IN SELECT id, name FROM students WHERE section_id=sec_id AND is_active=true LOOP
    hw_status := CASE
      WHEN st.name IN ('Priya Nair','Rohan Mehta') THEN 'not_submitted'
      WHEN st.name IN ('Aarav Kapoor','Dev Patel') THEN 'completed'
      ELSE 'partial'
    END;
    INSERT INTO homework_submissions (school_id, section_id, student_id, homework_date, status, recorded_by)
    VALUES (sid, sec_id, st.id, '2026-06-16', hw_status, tid)
    ON CONFLICT (student_id, homework_date) DO UPDATE SET status=EXCLUDED.status;
  END LOOP;
END $$;

-- ── 11. TEACHER STREAK ───────────────────────────────────────
INSERT INTO teacher_streaks (teacher_id, school_id, current_streak, best_streak, last_completed_date)
SELECT u.id, 'a0000000-0000-0000-0000-000000000001', 11, 11, '2026-06-16'
FROM users u WHERE u.school_id='a0000000-0000-0000-0000-000000000001' AND u.mobile='9800000003'
ON CONFLICT (teacher_id, school_id) DO UPDATE
  SET current_streak=11, best_streak=11, last_completed_date='2026-06-16';

-- ── 12. CHILD JOURNEY ENTRIES ────────────────────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  aarav  UUID;
  priya  UUID;
  rohan  UUID;
  ananya UUID;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users    WHERE school_id=sid AND mobile='9800000003';
  SELECT id INTO aarav  FROM students WHERE section_id=sec_id AND name='Aarav Kapoor';
  SELECT id INTO priya  FROM students WHERE section_id=sec_id AND name='Priya Nair';
  SELECT id INTO rohan  FROM students WHERE section_id=sec_id AND name='Rohan Mehta';
  SELECT id INTO ananya FROM students WHERE section_id=sec_id AND name='Ananya Singh';

  -- Aarav: highlight today (his birthday is April 17 — demo day!)
  INSERT INTO child_journey_entries
    (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
  SELECT sid,aarav,sec_id,tid,'2026-06-16','highlight',
    'Aarav recited the full alphabet song today without any help. The whole class cheered!',
    E'What a proud moment in class today! Aarav stood up during Circle Time and recited the entire alphabet song completely on his own — without any prompting. The whole class erupted in cheers and applause! His confidence has grown so beautifully over these weeks, and his enthusiasm for learning is truly infectious. We are so proud of you, Aarav! 🌟',
    true, now()
  WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=aarav AND entry_date='2026-06-16' AND entry_type='highlight');

  -- Priya: daily (she was absent June 16, so entry from June 13)
  INSERT INTO child_journey_entries
    (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
  SELECT sid,priya,sec_id,tid,'2026-06-13','daily',
    'Priya was very focused during math today. She helped a friend count the blocks.',
    E'Priya had a wonderful day in class today! During our Math activity, she was completely focused and counted all 10 blocks correctly. What made it extra special was that she quietly helped her friend who was struggling — showing such warmth and empathy. Priya is growing not just academically but as a caring, kind-hearted little person. We love having her in class! 💚',
    true, now() - INTERVAL '3 days'
  WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=priya AND entry_date='2026-06-13' AND entry_type='daily');

  -- Rohan: weekly summary
  INSERT INTO child_journey_entries
    (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
  SELECT sid,rohan,sec_id,tid,'2026-06-13','weekly',
    'Rohan had a great week. Improved a lot in English speaking. More confident now.',
    E'This has been a fantastic week for Rohan! We have seen remarkable improvement in his English speaking — he is raising his hand more often, forming complete sentences, and speaking with growing confidence. By Friday he was one of the first to volunteer during our speaking activity. Keep encouraging him at home — he is on a wonderful journey! 📚',
    true, now() - INTERVAL '3 days'
  WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=rohan AND entry_date='2026-06-13' AND entry_type='weekly');

  -- Ananya: highlight
  INSERT INTO child_journey_entries
    (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
  SELECT sid,ananya,sec_id,tid,'2026-06-10','highlight',
    'Ananya drew the most beautiful family picture today. She labelled everyone by name!',
    E'Today was a special moment for Ananya! During our Art activity, she drew a beautiful picture of her family and — completely on her own — labelled each person by name. For a child her age, this shows wonderful letter recognition and creative expression. Her picture is now proudly displayed in our classroom. What a talented little star! 🎨',
    true, now() - INTERVAL '6 days'
  WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=ananya AND entry_date='2026-06-10' AND entry_type='highlight');
END $$;

-- ── 13. ANNOUNCEMENTS ────────────────────────────────────────
DO $$
DECLARE
  sid UUID := 'a0000000-0000-0000-0000-000000000001';
  aid UUID;
  cid UUID;
BEGIN
  SELECT id INTO aid FROM users   WHERE school_id=sid AND mobile='9800000001';
  SELECT id INTO cid FROM classes WHERE school_id=sid AND name='UKG';

  -- Delete old demo announcements
  DELETE FROM announcements WHERE school_id=sid AND author_id=aid;

  INSERT INTO announcements (school_id, author_id, title, body, target_audience, target_class_id, expires_at)
  VALUES
  (sid, aid,
   'Annual Sports Day — 15 July 2026',
   'Dear Parents and Staff, we are excited to announce our Annual Sports Day on 15th July 2026. All students should wear their sports uniform. Parents are warmly invited to cheer for our little champions!',
   'all', NULL, '2026-07-16'),
  (sid, aid,
   'UKG Art Activity Tomorrow — Please Send Apron',
   'Dear UKG Parents, tomorrow (June 18) we have a special Art activity. Please send an old shirt or apron with your child to protect their uniform. All materials will be provided.',
   'class', cid, '2026-06-19'),
  (sid, aid,
   'Parent-Teacher Meeting — 25 June 2026',
   'We invite all parents to our Parent-Teacher Meeting on 25th June 2026 from 9 AM to 12 PM. This is a wonderful opportunity to discuss your child''s progress. Please confirm your slot via the school office.',
   'parents', NULL, '2026-06-26');
END $$;

-- ── 14. PARENT NOTIFICATIONS (for June 16 completion) ────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  comp_id UUID;
  p1 UUID; p2 UUID;
BEGIN
  SELECT id INTO cid    FROM classes  WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections WHERE class_id=cid AND label='A';
  SELECT id INTO p1     FROM parent_users WHERE school_id=sid AND mobile='9800000004';
  SELECT id INTO p2     FROM parent_users WHERE school_id=sid AND mobile='9800000005';
  SELECT id INTO comp_id FROM daily_completions
    WHERE section_id=sec_id AND completion_date='2026-06-16';

  IF comp_id IS NOT NULL AND p1 IS NOT NULL THEN
    INSERT INTO parent_notifications (parent_id,completion_id,section_id,completion_date,chunks_covered,is_read)
    VALUES (p1,comp_id,sec_id,'2026-06-16',3,false)
    ON CONFLICT (parent_id,completion_id) DO NOTHING;
  END IF;
  IF comp_id IS NOT NULL AND p2 IS NOT NULL THEN
    INSERT INTO parent_notifications (parent_id,completion_id,section_id,completion_date,chunks_covered,is_read)
    VALUES (p2,comp_id,sec_id,'2026-06-16',3,false)
    ON CONFLICT (parent_id,completion_id) DO NOTHING;
  END IF;
END $$;

-- ── 15. MESSAGES (teacher ↔ parent thread) ───────────────────
DO $$
DECLARE
  sid    UUID := 'a0000000-0000-0000-0000-000000000001';
  sec_id UUID;
  cid    UUID;
  tid    UUID;
  p1     UUID;
  aarav  UUID;
BEGIN
  SELECT id INTO cid    FROM classes     WHERE school_id=sid AND name='UKG';
  SELECT id INTO sec_id FROM sections    WHERE class_id=cid AND label='A';
  SELECT id INTO tid    FROM users       WHERE school_id=sid AND mobile='9800000003';
  SELECT id INTO p1     FROM parent_users WHERE school_id=sid AND mobile='9800000004';
  SELECT id INTO aarav  FROM students    WHERE section_id=sec_id AND name='Aarav Kapoor';

  DELETE FROM messages WHERE school_id=sid AND teacher_id=tid AND parent_id=p1;

  INSERT INTO messages (school_id,teacher_id,parent_id,student_id,sender_role,body,sent_at)
  VALUES
  (sid,tid,p1,aarav,'teacher',
   'Hello! Just wanted to share that Aarav has been doing wonderfully this week. He recited the alphabet song today completely on his own — a huge milestone! And tomorrow is his birthday 🎂 We have a little surprise planned in class!',
   '2026-06-16 14:30:00'),
  (sid,tid,p1,aarav,'parent',
   'Thank you so much Ms. Kavitha! We are so happy to hear this. He has been practising every evening. He is so excited about his birthday tomorrow!',
   '2026-06-16 15:45:00'),
  (sid,tid,p1,aarav,'teacher',
   'That is wonderful! The home practice really shows. We will make tomorrow extra special for him. See you at drop-off! 🎉',
   '2026-06-16 16:00:00');
END $$;

-- ── 16. VERIFY ───────────────────────────────────────────────
SELECT '=== DEMO DATA SUMMARY ===' as info;

SELECT 'Completions: ' || COUNT(*) || ' days (June 2-16)'
FROM daily_completions dc
JOIN sections s ON s.id=dc.section_id
JOIN classes c ON c.id=s.class_id
WHERE dc.school_id='a0000000-0000-0000-0000-000000000001'
  AND c.name='UKG' AND dc.completion_date BETWEEN '2026-06-02' AND '2026-06-16';

SELECT 'June 16 partial: ' || array_length(covered_chunk_ids,1) || '/5 topics covered (2 carry forward)'
FROM daily_completions dc
JOIN sections s ON s.id=dc.section_id
JOIN classes c ON c.id=s.class_id
WHERE dc.school_id='a0000000-0000-0000-0000-000000000001'
  AND c.name='UKG' AND dc.completion_date='2026-06-16';

SELECT 'Absences June 16: ' || COUNT(*) || ' students absent'
FROM attendance_records ar
JOIN sections s ON s.id=ar.section_id
JOIN classes c ON c.id=s.class_id
WHERE ar.school_id='a0000000-0000-0000-0000-000000000001'
  AND c.name='UKG' AND ar.attend_date='2026-06-16' AND ar.status='absent';

SELECT 'Birthdays: ' || name || ' — ' || date_of_birth::text
FROM students
WHERE school_id='a0000000-0000-0000-0000-000000000001'
  AND date_of_birth IS NOT NULL
ORDER BY EXTRACT(MONTH FROM date_of_birth), EXTRACT(DAY FROM date_of_birth);

SELECT 'Journey entries: ' || COUNT(*) FROM child_journey_entries
WHERE school_id='a0000000-0000-0000-0000-000000000001';
