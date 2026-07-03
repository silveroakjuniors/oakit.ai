-- Recalculate teacher streaks from actual daily_completions data
-- Accounts for both class teachers AND supporting teachers

-- Step 1: Build a complete picture of which teachers get credit for which completion dates
-- A teacher gets credit if they are either:
--   (a) the class_teacher_id of the section, OR
--   (b) listed in teacher_sections for that section
WITH teacher_completion_dates AS (
  SELECT DISTINCT t.teacher_id, dc.school_id, dc.completion_date
  FROM daily_completions dc
  JOIN (
    -- Class teachers
    SELECT id AS section_id, class_teacher_id AS teacher_id FROM sections WHERE class_teacher_id IS NOT NULL
    UNION
    -- Supporting teachers
    SELECT section_id, teacher_id FROM teacher_sections
  ) t ON t.section_id = dc.section_id
  WHERE dc.completion_date IS NOT NULL
),
-- Step 2: Get latest completion and total count per teacher
teacher_stats AS (
  SELECT
    teacher_id,
    school_id,
    COUNT(DISTINCT completion_date)::int AS total_days,
    MAX(completion_date) AS last_date
  FROM teacher_completion_dates
  GROUP BY teacher_id, school_id
)

-- Step 3: Update existing streak records
UPDATE teacher_streaks ts
SET
  current_streak = s.total_days,
  best_streak = GREATEST(ts.best_streak, s.total_days),
  last_completed_date = s.last_date,
  updated_at = now()
FROM teacher_stats s
WHERE ts.teacher_id = s.teacher_id AND ts.school_id = s.school_id;

-- Step 4: Insert for teachers who have completions but no streak row yet
INSERT INTO teacher_streaks (teacher_id, school_id, current_streak, best_streak, last_completed_date, updated_at)
SELECT s.teacher_id, s.school_id, s.total_days, s.total_days, s.last_date, now()
FROM (
  SELECT DISTINCT t.teacher_id, dc.school_id,
    COUNT(DISTINCT dc.completion_date)::int AS total_days,
    MAX(dc.completion_date) AS last_date
  FROM daily_completions dc
  JOIN (
    SELECT id AS section_id, class_teacher_id AS teacher_id FROM sections WHERE class_teacher_id IS NOT NULL
    UNION
    SELECT section_id, teacher_id FROM teacher_sections
  ) t ON t.section_id = dc.section_id
  GROUP BY t.teacher_id, dc.school_id
) s
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_streaks ts WHERE ts.teacher_id = s.teacher_id AND ts.school_id = s.school_id
)
ON CONFLICT (teacher_id, school_id) DO NOTHING;

-- Verify results
SELECT u.name, ts.current_streak, ts.best_streak, ts.last_completed_date
FROM teacher_streaks ts
JOIN users u ON u.id = ts.teacher_id
ORDER BY u.name;
