-- =============================================================================
-- Fix: Mark all scheduled day_plans up to today as completed
--      + backfill daily_completions + rebuild teacher_streaks
-- School: eea3411f-70e0-485b-a5cd-a7c29abfce10
-- Run in Supabase SQL editor
-- =============================================================================

BEGIN;

-- ── STEP 1: Mark all scheduled/pending day_plans up to today as 'completed' ──
UPDATE day_plans
SET    status = 'completed'
WHERE  school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10'
  AND  plan_date <= CURRENT_DATE
  AND  status IN ('scheduled', 'pending')
  AND  array_length(chunk_ids, 1) > 0;   -- only plans that actually have curriculum

-- ── STEP 2: Backfill daily_completions for every completed plan ───────────────
-- When day_plans.teacher_id is NULL, fall back to sections.class_teacher_id.
-- ON CONFLICT DO NOTHING so existing completions are preserved.
INSERT INTO daily_completions
       (school_id, section_id, teacher_id, completion_date, covered_chunk_ids, submitted_at)
SELECT dp.school_id,
       dp.section_id,
       COALESCE(dp.teacher_id, s.class_teacher_id) AS teacher_id,
       dp.plan_date                                 AS completion_date,
       dp.chunk_ids                                 AS covered_chunk_ids,
       (dp.plan_date::timestamptz + interval '9 hours') AS submitted_at
FROM   day_plans dp
JOIN   sections  s ON s.id = dp.section_id
WHERE  dp.school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10'
  AND  dp.status    = 'completed'
  AND  dp.plan_date <= CURRENT_DATE
  AND  array_length(dp.chunk_ids, 1) > 0
  AND  COALESCE(dp.teacher_id, s.class_teacher_id) IS NOT NULL  -- skip if no teacher assigned at all
ON CONFLICT (section_id, completion_date) DO NOTHING;

-- ── STEP 3: Rebuild teacher_streaks ──────────────────────────────────────────
-- For each teacher, count distinct days they submitted completions and compute
-- current streak (consecutive working days up to today) and best streak.

-- 3a. Gather each teacher's completion dates (distinct, ordered)
WITH teacher_dates AS (
  SELECT  dc.teacher_id,
          dc.school_id,
          dc.completion_date
  FROM    daily_completions dc
  WHERE   dc.school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10'
  GROUP BY dc.teacher_id, dc.school_id, dc.completion_date
),
-- 3b. Assign an "island" group to each consecutive-day run
-- Two dates are consecutive if the diff equals the number of intervening calendar
-- days with day_plans (we just use row_number trick — works for daily streaks).
ranked AS (
  SELECT  teacher_id,
          school_id,
          completion_date,
          ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY completion_date) AS rn,
          completion_date - (ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY completion_date))::int AS grp
  FROM    teacher_dates
),
-- 3c. Count streak lengths per island group
streak_groups AS (
  SELECT  teacher_id,
          school_id,
          grp,
          COUNT(*)                AS streak_len,
          MAX(completion_date)    AS last_date
  FROM    ranked
  GROUP BY teacher_id, school_id, grp
),
-- 3d. Best streak per teacher
best AS (
  SELECT  teacher_id,
          school_id,
          MAX(streak_len)         AS best_streak
  FROM    streak_groups
  GROUP BY teacher_id, school_id
),
-- 3e. Current streak = the streak whose last_date is today or yesterday
--     (yesterday because some teachers mark at end of day)
current_streak AS (
  SELECT  sg.teacher_id,
          sg.school_id,
          sg.streak_len           AS current_streak,
          sg.last_date            AS last_completed_date
  FROM    streak_groups sg
  WHERE   sg.last_date >= CURRENT_DATE - INTERVAL '1 day'
),
-- 3f. Combine
final AS (
  SELECT  b.teacher_id,
          b.school_id,
          COALESCE(cs.current_streak, 0)          AS current_streak,
          b.best_streak,
          cs.last_completed_date
  FROM    best b
  LEFT JOIN current_streak cs
         ON cs.teacher_id = b.teacher_id
        AND cs.school_id  = b.school_id
)
INSERT INTO teacher_streaks (teacher_id, school_id, current_streak, best_streak, last_completed_date, updated_at)
SELECT  teacher_id,
        school_id,
        current_streak,
        best_streak,
        last_completed_date,
        now()
FROM    final
ON CONFLICT (teacher_id, school_id) DO UPDATE
  SET current_streak       = EXCLUDED.current_streak,
      best_streak          = GREATEST(teacher_streaks.best_streak, EXCLUDED.best_streak),
      last_completed_date  = EXCLUDED.last_completed_date,
      updated_at           = now();

-- ── STEP 4: Verification ─────────────────────────────────────────────────────
SELECT 'day_plans completed'  AS check_item,  COUNT(*) AS count
FROM   day_plans
WHERE  school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10'
  AND  status = 'completed'
  AND  plan_date <= CURRENT_DATE
UNION ALL
SELECT 'daily_completions',   COUNT(*)
FROM   daily_completions
WHERE  school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10'
  AND  completion_date <= CURRENT_DATE
UNION ALL
SELECT 'teacher_streaks rows', COUNT(*)
FROM   teacher_streaks
WHERE  school_id = 'eea3411f-70e0-485b-a5cd-a7c29abfce10';

COMMIT;
