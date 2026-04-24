-- ============================================================
-- DEMO SEED: Observations + Journey Entries for June 1-16
-- Students: Priya Nair, Aarav Kapoor, Rohan Mehta
-- Run in Supabase SQL Editor AFTER replacing the UUIDs below
-- ============================================================
-- STEP 1: Find your student IDs by running:
--   SELECT id, name FROM students WHERE name IN ('Priya Nair','Aarav Kapoor','Rohan Mehta');
-- STEP 2: Find your teacher ID:
--   SELECT id, name FROM users WHERE role = 'teacher' LIMIT 5;
-- STEP 3: Find your section ID:
--   SELECT id, label FROM sections LIMIT 5;
-- STEP 4: Replace the placeholders below and run

-- ============================================================
-- REPLACE THESE WITH REAL IDs FROM YOUR DB
-- ============================================================
DO $$
DECLARE
  priya_id     UUID := (SELECT id FROM students WHERE name ILIKE '%Priya%' LIMIT 1);
  aarav_id     UUID := (SELECT id FROM students WHERE name ILIKE '%Aarav%' LIMIT 1);
  rohan_id     UUID := (SELECT id FROM students WHERE name ILIKE '%Rohan%' LIMIT 1);
  v_teacher_id UUID := (SELECT id FROM users WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9800000003');
  v_school_id  UUID := 'a0000000-0000-0000-0000-000000000001';
  v_section_id UUID := (SELECT s.id FROM sections s JOIN classes c ON c.id = s.class_id WHERE c.school_id = 'a0000000-0000-0000-0000-000000000001' AND c.name = 'UKG' AND s.label = 'A');
BEGIN

-- ============================================================
-- PRIYA NAIR — Observations (June 1-16)
-- Key issues: pencil grip, fine motor, needs parent attention
-- ============================================================
INSERT INTO student_observations (student_id, teacher_id, school_id, obs_text, categories, share_with_parent, obs_date) VALUES
(priya_id, v_teacher_id, v_school_id, 'Priya holds her pencil with a fist grip instead of the correct 3-finger grip. Needs consistent correction and practice at home.', ARRAY['Motor Skills'], true, '2026-06-02'),
(priya_id, v_teacher_id, v_school_id, 'Priya was very quiet during circle time today. Did not participate in group discussion. Seems withdrawn — may need one-on-one attention.', ARRAY['Social Skills'], false, '2026-06-03'),
(priya_id, v_teacher_id, v_school_id, 'Excellent creativity today! Priya drew a beautiful picture of her family and narrated it confidently. Great imagination.', ARRAY['Other'], true, '2026-06-05'),
(priya_id, v_teacher_id, v_school_id, 'Priya fell asleep during the afternoon session. This is the second time this week. Parents should ensure she gets adequate sleep at night.', ARRAY['Behavior'], true, '2026-06-06'),
(priya_id, v_teacher_id, v_school_id, 'Writing exercise: Priya struggles to stay within lines. Her letter formation is inconsistent. Fine motor skills need focused practice.', ARRAY['Motor Skills'], true, '2026-06-09'),
(priya_id, v_teacher_id, v_school_id, 'Priya showed improvement in English speaking today — she answered 2 questions without prompting. Positive progress!', ARRAY['Language'], true, '2026-06-10'),
(priya_id, v_teacher_id, v_school_id, 'Priya was distracted during math activity. Needed multiple reminders to focus. Suggest limiting screen time at home before school.', ARRAY['Academic Progress'], true, '2026-06-12'),
(priya_id, v_teacher_id, v_school_id, 'Pencil grip still incorrect despite daily correction. Recommend parents practice pencil grip exercises at home using a triangular grip aid.', ARRAY['Motor Skills'], true, '2026-06-13'),
(priya_id, v_teacher_id, v_school_id, 'Priya helped a classmate who was crying today — showed beautiful empathy. Her social awareness is growing.', ARRAY['Social Skills'], true, '2026-06-16');

-- ============================================================
-- AARAV KAPOOR — Observations (June 1-16)
-- Key issues: overactive, needs to listen, strong academically
-- ============================================================
INSERT INTO student_observations (student_id, teacher_id, school_id, obs_text, categories, share_with_parent, obs_date) VALUES
(aarav_id, v_teacher_id, v_school_id, 'Aarav is very energetic and enthusiastic. He participates actively but sometimes speaks out of turn. Working on raising hand before speaking.', ARRAY['Behavior'], false, '2026-06-02'),
(aarav_id, v_teacher_id, v_school_id, 'Excellent number recognition today! Aarav counted to 50 without any help and identified all shapes correctly. Strong academic progress.', ARRAY['Academic Progress'], true, '2026-06-04'),
(aarav_id, v_teacher_id, v_school_id, 'Aarav had difficulty sitting still during story time. He kept moving around and disturbing neighbours. Needs support with self-regulation.', ARRAY['Behavior'], true, '2026-06-06'),
(aarav_id, v_teacher_id, v_school_id, 'Great improvement in pencil grip! Aarav is now holding his pencil correctly most of the time. His letter formation is neat and consistent.', ARRAY['Motor Skills'], true, '2026-06-09'),
(aarav_id, v_teacher_id, v_school_id, 'Aarav led the morning prayer today with confidence. His English pronunciation is excellent and he speaks clearly.', ARRAY['Language'], true, '2026-06-10'),
(aarav_id, v_teacher_id, v_school_id, 'Aarav pushed a classmate during outdoor play. We discussed why this is not acceptable. He apologised and the situation was resolved.', ARRAY['Social Skills'], true, '2026-06-11'),
(aarav_id, v_teacher_id, v_school_id, 'Aarav completed the GK worksheet first in class and helped two friends. Shows strong cognitive ability and willingness to help.', ARRAY['Academic Progress'], true, '2026-06-13'),
(aarav_id, v_teacher_id, v_school_id, 'Aarav is struggling to follow multi-step instructions. He starts before hearing the full instruction. Needs practice with listening skills.', ARRAY['Language'], false, '2026-06-16');

-- ============================================================
-- ROHAN MEHTA — Observations (June 1-16)
-- Key issues: shy, needs confidence, good at art
-- ============================================================
INSERT INTO student_observations (student_id, teacher_id, school_id, obs_text, categories, share_with_parent, obs_date) VALUES
(rohan_id, v_teacher_id, v_school_id, 'Rohan is very shy and rarely speaks in class. He communicates mostly through gestures. Needs gentle encouragement to use words.', ARRAY['Language'], true, '2026-06-02'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan created a stunning painting during art class — showed exceptional creativity and attention to detail. His best work yet!', ARRAY['Other'], true, '2026-06-04'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan sat alone during free play. When encouraged to join a group, he hesitated but eventually participated. Progress in social comfort.', ARRAY['Social Skills'], true, '2026-06-05'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan answered a question in class today for the first time this term! Small but significant step. Praised him in front of the class.', ARRAY['Language'], true, '2026-06-09'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan struggles with gross motor activities — running and jumping. He tires quickly and prefers sedentary activities. May benefit from outdoor play at home.', ARRAY['Motor Skills'], true, '2026-06-10'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan completed his writing worksheet neatly and on time. His fine motor skills are good — letters are well-formed.', ARRAY['Motor Skills'], true, '2026-06-12'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan was paired with Aarav for a group activity. He contributed ideas quietly but effectively. Peer pairing is working well for him.', ARRAY['Social Skills'], true, '2026-06-13'),
(rohan_id, v_teacher_id, v_school_id, 'Rohan seems tired and disengaged in the afternoons. Suggest parents ensure he has a light snack and rest before school. Energy levels are low.', ARRAY['Behavior'], true, '2026-06-16');

-- ============================================================
-- JOURNEY ENTRIES (June 1-16) — Daily highlights
-- ============================================================

-- PRIYA
INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,priya_id,v_section_id,v_teacher_id,'2026-06-02','daily','Priya was quiet today but drew a lovely picture. Pencil grip needs work.','Today Priya expressed herself beautifully through art, creating a colourful drawing that showed her imagination. We are working on her pencil grip together — with a little practice at home, she will be writing confidently very soon! 🎨',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=priya_id AND entry_date='2026-06-02' AND entry_type='daily');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,priya_id,v_section_id,v_teacher_id,'2026-06-06','daily','Priya fell asleep in class. Seems tired. Parents should check sleep schedule.',E'We noticed Priya seemed a little tired today. A good night''s sleep and a nutritious breakfast can make a big difference to her energy and focus in class. She is a bright child and we want to see her at her best every day! 😴',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=priya_id AND entry_date='2026-06-06' AND entry_type='daily');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,priya_id,v_section_id,v_teacher_id,'2026-06-10','highlight','Priya answered questions in English today without being asked. Big improvement!','What a wonderful moment today! Priya raised her hand and answered questions in English completely on her own — no prompting needed. This is a huge step forward in her confidence and communication skills. We are so proud of her! 🌟',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=priya_id AND entry_date='2026-06-10' AND entry_type='highlight');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,priya_id,v_section_id,v_teacher_id,'2026-06-16','weekly','This week Priya showed empathy, helped a friend, but still needs pencil grip practice.','This has been a week of beautiful moments for Priya! She showed wonderful empathy by comforting a classmate, and her English speaking is improving steadily. Our focus area for next week is pencil grip — a triangular grip aid would help greatly. Thank you for your support at home! 💚',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=priya_id AND entry_date='2026-06-16' AND entry_type='weekly');

-- AARAV
INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,aarav_id,v_section_id,v_teacher_id,'2026-06-04','daily','Aarav counted to 50 and identified all shapes. Very sharp today.','Aarav had a fantastic day! He counted all the way to 50 without any help and correctly identified every shape in our activity. His mathematical thinking is excellent for his age. Keep encouraging him with number games at home! 🔢',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=aarav_id AND entry_date='2026-06-04' AND entry_type='daily');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,aarav_id,v_section_id,v_teacher_id,'2026-06-10','highlight','Aarav led the morning prayer with confidence. Great English pronunciation.','A proud moment today — Aarav led the entire class in the morning prayer with confidence and clarity. His English pronunciation is excellent and his voice carried beautifully. He is becoming a natural leader! 🎤',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=aarav_id AND entry_date='2026-06-10' AND entry_type='highlight');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,aarav_id,v_section_id,v_teacher_id,'2026-06-13','daily','Aarav finished GK worksheet first and helped two friends. Very helpful today.','Aarav was a star today! He completed his General Knowledge worksheet first in the class and then quietly helped two of his friends who were struggling. This kind of initiative and generosity is wonderful to see. 🌟',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=aarav_id AND entry_date='2026-06-13' AND entry_type='daily');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,aarav_id,v_section_id,v_teacher_id,'2026-06-16','weekly','Good week overall. Needs to work on listening and not interrupting.','Aarav had a productive week with strong academic performance. Our focus for next week is listening skills — specifically waiting for instructions to finish before starting. This is a common challenge for energetic learners like Aarav, and with consistent practice he will master it! 👂',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=aarav_id AND entry_date='2026-06-16' AND entry_type='weekly');

-- ROHAN
INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,rohan_id,v_section_id,v_teacher_id,'2026-06-04','highlight','Rohan made an amazing painting today. Best work of the term!','Today Rohan created something truly special — a painting that showed incredible attention to detail and a beautiful sense of colour. His artistic talent is a real gift. Please do encourage his creativity at home — it is where he truly shines! 🎨',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=rohan_id AND entry_date='2026-06-04' AND entry_type='highlight');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,rohan_id,v_section_id,v_teacher_id,'2026-06-09','highlight','Rohan answered a question in class for the first time this term!','A milestone moment today! Rohan raised his hand and answered a question in class — for the very first time this term. We celebrated this with the whole class and he beamed with pride. This is the beginning of a wonderful journey in confidence for Rohan! 🌱',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=rohan_id AND entry_date='2026-06-09' AND entry_type='highlight');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,rohan_id,v_section_id,v_teacher_id,'2026-06-13','daily','Rohan worked well with Aarav in group activity. Good progress socially.','Rohan had a lovely day working with a partner during our group activity. He contributed ideas quietly but effectively, and his partner listened and appreciated his input. Peer collaboration is really helping Rohan come out of his shell! 🤝',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=rohan_id AND entry_date='2026-06-13' AND entry_type='daily');

INSERT INTO child_journey_entries (school_id,student_id,section_id,teacher_id,entry_date,entry_type,raw_text,beautified_text,is_sent_to_parent,sent_at)
SELECT v_school_id,rohan_id,v_section_id,v_teacher_id,'2026-06-16','weekly','Rohan is growing in confidence. Art is his strength. Needs more outdoor activity.','What a journey Rohan is on! This week we saw him speak up, collaborate, and shine in art. Our suggestion for home: encourage outdoor play and physical activity — it will build his energy and confidence. He is a wonderful, thoughtful child and we are excited to see him grow! 🌟',true,now()
WHERE NOT EXISTS (SELECT 1 FROM child_journey_entries WHERE student_id=rohan_id AND entry_date='2026-06-16' AND entry_type='weekly');

END $$;
