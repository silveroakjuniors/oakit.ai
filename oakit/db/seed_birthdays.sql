-- ============================================================
-- STEP 1: Run migration 045 (adds date_of_birth column)
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
CREATE INDEX IF NOT EXISTS idx_students_dob ON students(date_of_birth);

-- ============================================================
-- STEP 2: Set birthdays for demo students
-- Replace school_id with yours if different
-- Dates are set so some fall TODAY and some in next 7 days
-- ============================================================

-- Set Aarav Kapoor birthday = TODAY (for demo)
UPDATE students
SET date_of_birth = CURRENT_DATE
WHERE name = 'Aarav Kapoor'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Set Priya Nair birthday = tomorrow
UPDATE students
SET date_of_birth = CURRENT_DATE + 1
WHERE name = 'Priya Nair'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Set Rohan Mehta birthday = in 3 days
UPDATE students
SET date_of_birth = CURRENT_DATE + 3
WHERE name = 'Rohan Mehta'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Set Ananya Singh birthday = in 5 days
UPDATE students
SET date_of_birth = CURRENT_DATE + 5
WHERE name = 'Ananya Singh'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- Set remaining students with realistic past birthdays (won't show in widget)
UPDATE students
SET date_of_birth = '2020-08-15'
WHERE name = 'Dev Patel'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE students
SET date_of_birth = '2020-11-22'
WHERE name = 'Sia Sharma'
  AND school_id = 'a0000000-0000-0000-0000-000000000001';

-- ============================================================
-- STEP 3: For ALL your real students — bulk update template
-- Run this query first to see all students without DOB:
-- ============================================================
-- SELECT id, name, class_id, section_id FROM students
-- WHERE school_id = 'a0000000-0000-0000-0000-000000000001'
--   AND date_of_birth IS NULL
-- ORDER BY name;

-- Then update each one:
-- UPDATE students SET date_of_birth = 'YYYY-MM-DD' WHERE id = '<student-uuid>';

-- ============================================================
-- STEP 4: Verify
-- ============================================================
SELECT name, date_of_birth,
  CASE
    WHEN EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
     AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
    THEN '🎂 TODAY!'
    ELSE 'upcoming'
  END as status
FROM students
WHERE school_id = 'a0000000-0000-0000-0000-000000000001'
  AND date_of_birth IS NOT NULL
ORDER BY EXTRACT(MONTH FROM date_of_birth), EXTRACT(DAY FROM date_of_birth);
