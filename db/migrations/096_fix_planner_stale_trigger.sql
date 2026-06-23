-- Migration 096: Fix mark_planner_sessions_stale trigger
-- The shared trigger function references NEW.holiday_date which doesn't exist on
-- special_days (it has day_date instead). PostgreSQL 42703 error on INSERT to special_days.
-- Fix: replace the single shared function with two table-specific functions.

-- 1. Drop the broken triggers first
DROP TRIGGER IF EXISTS trg_holidays_stale     ON holidays;
DROP TRIGGER IF EXISTS trg_special_days_stale ON special_days;

-- 2. Drop the old shared function
DROP FUNCTION IF EXISTS mark_planner_sessions_stale();

-- 3. Create a function for the holidays table (uses holiday_date)
CREATE OR REPLACE FUNCTION mark_planner_stale_holidays()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE textbook_planner_sessions
    SET status = 'stale'
    WHERE school_id = COALESCE(NEW.school_id, OLD.school_id)
      AND status IN ('generated', 'draft')
      AND academic_year = EXTRACT(YEAR FROM COALESCE(NEW.holiday_date, OLD.holiday_date))::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a function for the special_days table (uses day_date)
CREATE OR REPLACE FUNCTION mark_planner_stale_special_days()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE textbook_planner_sessions
    SET status = 'stale'
    WHERE school_id = COALESCE(NEW.school_id, OLD.school_id)
      AND status IN ('generated', 'draft')
      AND academic_year = EXTRACT(YEAR FROM COALESCE(NEW.day_date, OLD.day_date))::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Re-attach triggers with the correct functions
CREATE OR REPLACE TRIGGER trg_holidays_stale
AFTER INSERT OR DELETE ON holidays
FOR EACH ROW EXECUTE FUNCTION mark_planner_stale_holidays();

CREATE OR REPLACE TRIGGER trg_special_days_stale
AFTER INSERT OR DELETE ON special_days
FOR EACH ROW EXECUTE FUNCTION mark_planner_stale_special_days();
