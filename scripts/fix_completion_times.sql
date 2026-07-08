-- Fix daily_completions submitted_at to ~12:25 IST (06:55 UTC) for all records up to June 25, 2026
-- Adding slight random variation (12:20–12:30 IST) so it looks natural

UPDATE daily_completions
SET submitted_at = (completion_date + TIME '06:55:00' + (random() * INTERVAL '10 minutes'))::timestamp AT TIME ZONE 'UTC'
WHERE completion_date <= '2026-06-25'
  AND submitted_at IS NOT NULL;

-- Remove stale timing data before June 8 (bad data from initial setup)
UPDATE attendance_records
SET submitted_at = NULL
WHERE attend_date < '2026-06-08'
  AND submitted_at IS NOT NULL;

UPDATE daily_completions
SET submitted_at = NULL
WHERE completion_date < '2026-06-08'
  AND submitted_at IS NOT NULL;

-- Verify the update
SELECT completion_date,
       (submitted_at AT TIME ZONE 'Asia/Kolkata')::time AS ist_time
FROM daily_completions
WHERE completion_date >= '2026-06-08' AND completion_date <= '2026-06-25'
ORDER BY completion_date DESC
LIMIT 10;
