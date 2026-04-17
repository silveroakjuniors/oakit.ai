from datetime import date, timedelta
import logging
import math
from uuid import UUID
from db import get_pool

logger = logging.getLogger(__name__)


def get_working_days(start: date, end: date, working_days: list[int], holidays: list[date]) -> list[date]:
    """Return list of working dates between start and end (inclusive).
    working_days uses isoweekday convention: 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun.
    Note: even if working_days contains 7 (Sunday), we still include it — the school
    may have Sunday as a working day. The caller is responsible for correct configuration.
    """
    days = []
    current = start
    holiday_set = set(holidays)
    while current <= end:
        if current.isoweekday() in working_days and current not in holiday_set:
            days.append(current)
        current += timedelta(days=1)
    return days


def _split_chunk(content: str) -> tuple[str, str]:
    """Split chunk content at its midpoint by character count."""
    mid = len(content) // 2
    return content[:mid], content[mid:]


async def generate_plans(class_id: str, section_id: str, school_id: str, academic_year: str,
                         month: int = None, plan_year: int = None) -> int:
    pool = await get_pool()

    cal = await pool.fetchrow(
        "SELECT * FROM school_calendar WHERE school_id = $1 AND academic_year = $2",
        UUID(school_id), academic_year
    )
    if not cal:
        raise ValueError("School calendar not configured")

    teacher = await pool.fetchrow(
        """SELECT COALESCE(ts.teacher_id, s.class_teacher_id) as teacher_id
           FROM sections s
           LEFT JOIN teacher_sections ts ON ts.section_id = s.id
           WHERE s.id = $1
           LIMIT 1""",
        UUID(section_id)
    )
    if not teacher or not teacher["teacher_id"]:
        raise ValueError("No teacher assigned to section")

    chunks = await pool.fetch(
        "SELECT id FROM curriculum_chunks WHERE class_id = $1 ORDER BY chunk_index",
        UUID(class_id)
    )
    if not chunks:
        raise ValueError("No curriculum chunks found for class")

    all_chunk_ids = [str(r["id"]) for r in chunks]

    holiday_rows = await pool.fetch(
        "SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2",
        UUID(school_id), academic_year
    )
    holidays = [r["holiday_date"] for r in holiday_rows]

    special_rows = await pool.fetch(
        "SELECT day_date, day_type, label, duration_type FROM special_days WHERE school_id = $1 AND academic_year = $2",
        UUID(school_id), academic_year
    )
    full_day_set = {r["day_date"] for r in special_rows if r["duration_type"] == "full_day"}
    half_day_set = {r["day_date"] for r in special_rows if r["duration_type"] == "half_day"}
    special_day_set = full_day_set | half_day_set  # all special days (for placeholder creation)
    special_day_info = {r["day_date"]: (r["day_type"], r["label"]) for r in special_rows}

    # Determine date range
    cal_start = cal["start_date"]
    cal_end = cal["end_date"]

    if month and plan_year:
        # Monthly mode: only generate for the given month
        from calendar import monthrange
        month_start = date(plan_year, month, 1)
        month_end = date(plan_year, month, monthrange(plan_year, month)[1])
        # Clamp to calendar bounds, but range_start is always >= month_start (never before the month)
        range_start = max(cal_start, month_start)
        range_end = min(cal_end, month_end)
        # Safety: ensure range_start is never before the requested month
        if range_start < month_start:
            range_start = month_start
    else:
        # Full year mode
        range_start = cal_start
        range_end = cal_end

    all_working_days = get_working_days(cal_start, cal_end, list(cal["working_days"]), holidays)
    # Half-day dates receive content; only full-day specials are excluded from curriculum days
    all_curriculum_days = [d for d in all_working_days if d not in full_day_set]

    # For monthly mode: figure out which chunk index to start from.
    # Half-days advance the index by 0.5; normal curriculum days advance by 1.
    if month and plan_year:
        days_before = [d for d in all_curriculum_days if d < range_start]
        chunk_start_idx = sum(0.5 if d in half_day_set else 1.0 for d in days_before)

        # Delete existing plans for this section in this month only
        await pool.execute(
            "DELETE FROM day_plans WHERE section_id = $1 AND plan_date >= $2 AND plan_date <= $3",
            UUID(section_id), range_start, range_end
        )
    else:
        chunk_start_idx = 0.0
        # Delete all existing plans for this section
        await pool.execute("DELETE FROM day_plans WHERE section_id = $1", UUID(section_id))

    # Get curriculum days in the target range (half-days included, full-day specials excluded)
    range_working = get_working_days(range_start, range_end, list(cal["working_days"]), holidays)
    range_curriculum_days = [d for d in range_working if d not in full_day_set]

    if not range_curriculum_days:
        # Still create special day placeholders
        for day in range_working:
            if day in special_day_set:
                day_type, label = special_day_info[day]
                await pool.execute(
                    """INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
                       VALUES ($1, $2, $3, $4, '{}', $5)
                       ON CONFLICT (section_id, plan_date) DO UPDATE SET chunk_ids = '{}', status = EXCLUDED.status""",
                    UUID(school_id), UUID(section_id), teacher["teacher_id"], day, day_type
                )
        return 0

    # Task 6.4: Cross-month carry-forward.
    # In monthly mode, read any carry_forward_fragment from the last day_plan of the preceding month.
    preceding_carry_fragment: str | None = None
    if month and plan_year:
        prev_plan = await pool.fetchrow(
            """SELECT carry_forward_fragment FROM day_plans
               WHERE section_id = $1 AND plan_date < $2
               ORDER BY plan_date DESC LIMIT 1""",
            UUID(section_id), range_start
        )
        if prev_plan and prev_plan["carry_forward_fragment"]:
            preceding_carry_fragment = prev_plan["carry_forward_fragment"]

    # Distribute chunks across curriculum days in this range.
    # Each day gets 1 chunk (or ceil if chunks < days).
    total_curriculum_days_year = len(all_curriculum_days)
    chunks_per_day = math.ceil(len(all_chunk_ids) / total_curriculum_days_year) if total_curriculum_days_year > 0 else 1

    plans_created = 0
    # Track carry-forward fragment to prepend to the next working day
    pending_fragment: str | None = None

    for i, day in enumerate(range_curriculum_days):
        # chunk_start_idx is a float; each half-day consumed 0.5, each full day 1.0
        global_idx = int(chunk_start_idx + sum(
            0.5 if d in half_day_set else 1.0 for d in range_curriculum_days[:i]
        ))
        # Always cycle through chunks — wrap around using modulo so chunks repeat
        # evenly across the full year regardless of how many days vs chunks there are.
        cycle_start = (global_idx * chunks_per_day) % len(all_chunk_ids)
        day_chunk_ids = all_chunk_ids[cycle_start:cycle_start + chunks_per_day]
        # Handle wrap-around at end of chunk list
        if len(day_chunk_ids) < chunks_per_day:
            day_chunk_ids = day_chunk_ids + all_chunk_ids[:chunks_per_day - len(day_chunk_ids)]

        if day in half_day_set:
            # Task 6.3: Half-day plan writing.
            # Fetch the full chunk content for the assigned chunk.
            chunk_row = await pool.fetchrow(
                "SELECT content FROM curriculum_chunks WHERE id = $1",
                UUID(day_chunk_ids[0])
            )
            chunk_content = chunk_row["content"] if chunk_row else ""
            first_half, second_half = _split_chunk(chunk_content)

            # Determine carry-forward fragment to prepend (from preceding month or previous half-day)
            carry_in = preceding_carry_fragment if i == 0 else pending_fragment
            preceding_carry_fragment = None  # consumed
            pending_fragment = None

            # Write first half to current day; store first-half text as carry_forward_fragment
            combined_first = (carry_in or "") + first_half if carry_in else first_half
            await pool.execute(
                """INSERT INTO day_plans
                       (school_id, section_id, teacher_id, plan_date, chunk_ids, status, carry_forward_fragment)
                   VALUES ($1, $2, $3, $4, $5::uuid[], 'scheduled', $6)
                   ON CONFLICT (section_id, plan_date) DO UPDATE
                   SET chunk_ids = EXCLUDED.chunk_ids, status = 'scheduled',
                       carry_forward_fragment = EXCLUDED.carry_forward_fragment""",
                UUID(school_id), UUID(section_id), teacher["teacher_id"], day,
                day_chunk_ids, combined_first
            )
            plans_created += 1

            # Find the next working day in the range to prepend the second half
            next_days = range_curriculum_days[i + 1:]
            if next_days:
                # Store second half as pending; it will be prepended when we process the next day
                pending_fragment = second_half
            else:
                # No next working day in range — store fragment with status='carried_forward' and warn
                logger.warning(
                    "Half-day carry-forward has no subsequent working day in range for section %s on %s",
                    section_id, day
                )
                await pool.execute(
                    """UPDATE day_plans SET carry_forward_fragment = $1, status = 'carried_forward'
                       WHERE section_id = $2 AND plan_date = $3""",
                    second_half, UUID(section_id), day
                )
        else:
            # Normal curriculum day
            carry_in = preceding_carry_fragment if i == 0 else pending_fragment
            preceding_carry_fragment = None
            pending_fragment = None

            if carry_in:
                # Prepend the carry-forward fragment from the previous half-day (or preceding month)
                await pool.execute(
                    """INSERT INTO day_plans
                           (school_id, section_id, teacher_id, plan_date, chunk_ids, status, carry_forward_fragment)
                       VALUES ($1, $2, $3, $4, $5::uuid[], 'scheduled', $6)
                       ON CONFLICT (section_id, plan_date) DO UPDATE
                       SET chunk_ids = EXCLUDED.chunk_ids, status = 'scheduled',
                           carry_forward_fragment = EXCLUDED.carry_forward_fragment""",
                    UUID(school_id), UUID(section_id), teacher["teacher_id"], day,
                    day_chunk_ids, carry_in
                )
            else:
                await pool.execute(
                    """INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
                       VALUES ($1, $2, $3, $4, $5::uuid[], 'scheduled')
                       ON CONFLICT (section_id, plan_date) DO UPDATE
                       SET chunk_ids = EXCLUDED.chunk_ids, status = 'scheduled'""",
                    UUID(school_id), UUID(section_id), teacher["teacher_id"], day, day_chunk_ids
                )
            plans_created += 1

    # Create placeholder plans for full-day special days in range
    # Only create for actual working days (guards against bad data in special_days)
    for day in range_working:
        if day in full_day_set:
            # Extra guard: verify this day is actually a working day (not weekend)
            if day.isoweekday() not in list(cal["working_days"]):
                logger.warning("Skipping special day placeholder for non-working day %s", day)
                continue
            day_type, label = special_day_info[day]
            await pool.execute(
                """INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
                   VALUES ($1, $2, $3, $4, '{}', $5)
                   ON CONFLICT (section_id, plan_date) DO UPDATE SET chunk_ids = '{}', status = EXCLUDED.status""",
                UUID(school_id), UUID(section_id), teacher["teacher_id"], day, day_type
            )

    return plans_created


async def carry_forward_pending(section_id: str, plan_date: str, pending_chunk_ids: list[str]) -> None:
    """Prepend pending chunks to the next working day's plan."""
    pool = await get_pool()

    next_plan = await pool.fetchrow(
        "SELECT id, chunk_ids FROM day_plans WHERE section_id = $1 AND plan_date > $2 ORDER BY plan_date LIMIT 1",
        UUID(section_id), date.fromisoformat(plan_date)
    )

    if next_plan:
        existing = list(next_plan["chunk_ids"] or [])
        # Prepend pending chunks (avoid duplicates)
        new_ids = pending_chunk_ids + [c for c in existing if c not in pending_chunk_ids]
        await pool.execute(
            "UPDATE day_plans SET chunk_ids = $1::uuid[] WHERE id = $2",
            new_ids, next_plan["id"]
        )

    # Mark current plan as carried_forward
    await pool.execute(
        "UPDATE day_plans SET status = 'carried_forward' WHERE section_id = $1 AND plan_date = $2",
        UUID(section_id), date.fromisoformat(plan_date)
    )
