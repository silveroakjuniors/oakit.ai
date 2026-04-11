"""
planner_engine.py — Planner calculation functions.
"""

from __future__ import annotations
import logging
from datetime import date, timedelta

logger = logging.getLogger(__name__)


def _topic_name(t) -> str:
    """Extract topic name from either a string or a {name, page_start} dict."""
    if isinstance(t, str):
        return t
    if isinstance(t, dict):
        return t.get("name") or t.get("title") or str(t)
    return str(t)


def calculate_chapter_weights(chapters: list[dict]) -> list[dict]:
    if not chapters:
        return []
    spans = []
    for ch in chapters:
        s = ch.get("page_start") or 0
        e = ch.get("page_end") or 0
        spans.append(max(1, e - s + 1) if e >= s else 1)
    total = sum(spans) or len(spans)
    return [{**ch, "chapter_weight": span / total} for ch, span in zip(chapters, spans)]


def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def calculate_available_minutes(parameters: dict) -> int:
    total = _time_to_minutes(parameters["school_end"]) - _time_to_minutes(parameters["school_start"])
    if total <= 0:
        raise ValueError("school_end must be after school_start")
    non = 0
    if parameters.get("lunch_start") and parameters.get("lunch_end"):
        non += _time_to_minutes(parameters["lunch_end"]) - _time_to_minutes(parameters["lunch_start"])
    if parameters.get("snack_start") and parameters.get("snack_end"):
        non += _time_to_minutes(parameters["snack_end"]) - _time_to_minutes(parameters["snack_start"])
    non += int(parameters.get("sports_minutes_per_week") or 0) // 5
    for a in parameters.get("activities") or []:
        non += int(a.get("daily_minutes") or 0)
    if non >= total:
        raise ValueError(f"Non-teaching time ({non} min) >= school day ({total} min).")
    return total - non


def get_teaching_days(start_date, end_date, working_days, holidays, special_days):
    holiday_set = set(holidays)
    excluded = {sd["day_date"] for sd in special_days if sd.get("duration_type", "full_day") == "full_day"}
    result, cur = [], start_date
    while cur <= end_date:
        if cur.isoweekday() in working_days and cur not in holiday_set and cur not in excluded:
            result.append(cur)
        cur += timedelta(days=1)
    return sorted(result)


def insert_test_days(mode, params, teaching_days, chapters_by_subject):
    if mode == "manual":
        return [], []
    if mode == "specific-dates":
        return sorted({date.fromisoformat(d) for d in (params.get("specific_dates") or []) if d}), []
    if mode == "every-N-weeks":
        n = int(params.get("every_n_weeks") or 4)
        if not teaching_days:
            return [], []
        exam_days, candidate = [], teaching_days[0] + timedelta(weeks=n)
        while candidate <= teaching_days[-1]:
            actual = next((td for td in teaching_days if td >= candidate), None) or next((td for td in reversed(teaching_days) if td <= candidate), None)
            if actual and actual not in exam_days:
                exam_days.append(actual)
            candidate += timedelta(weeks=n)
        return sorted(exam_days), []
    if mode == "end-of-chapter":
        exam_set = set()
        for chapters in chapters_by_subject.values():
            for ch in chapters:
                ld = ch.get("last_teaching_day")
                if ld:
                    ld = date.fromisoformat(ld) if isinstance(ld, str) else ld
                    nxt = next((td for td in teaching_days if td > ld), None)
                    if nxt:
                        exam_set.add(nxt)
        return sorted(exam_set), []
    return [], []


def insert_revision_buffers(exam_days, teaching_days):
    exam_set, used, result = set(exam_days), set(), []
    for ed in sorted(exam_days):
        candidate = next((td for td in reversed(teaching_days) if td < ed and td not in exam_set and td not in used), None)
        if candidate:
            result.append(candidate)
            used.add(candidate)
        else:
            logger.warning("No revision buffer available before exam on %s", ed)
    return sorted(result)


async def distribute_topics_with_llm(subjects_data, teaching_days, exam_days, revision_days, holidays, parameters):
    """
    Generate a smart interleaved planner using OpenAI.

    Strategy: send a COMPACT prompt (subject names, weekly hours, chapter titles only —
    NOT individual topics) asking the LLM to produce a day-by-day subject assignment.
    Then apply topics deterministically in TOC order onto the LLM's subject schedule.

    This avoids token overflow while still getting intelligent scheduling.
    Falls back to deterministic round-robin if LLM fails.
    """
    import json
    from query_pipeline import _call_llm

    if not teaching_days or not subjects_data:
        return []

    # Build compact subject summary — chapter titles only, no individual topics
    subjects_compact = []
    for s in subjects_data:
        chapters = s.get("chapters") or []
        chapter_titles = [ch.get("title", "") for ch in chapters]
        total_topics = sum(
            len(ch.get("topics") or [ch.get("title")]) for ch in chapters
        )
        subjects_compact.append({
            "subject": s.get("subject_name", ""),
            "weekly_hours": float(s.get("weekly_hours") or 1),
            "chapters": chapter_titles,
            "total_topics": total_topics,
        })

    # Send only first 10 teaching days to the LLM — just enough to establish the weekly pattern
    # The pattern repeats weekly, so 10 days (2 weeks) is sufficient
    sample_days = [d.isoformat() for d in teaching_days[:10]]
    exam_days_str = [d.isoformat() for d in exam_days[:5]]  # limit for prompt size
    revision_days_str = [d.isoformat() for d in revision_days[:5]]

    system = (
        "You are an academic curriculum planner. Generate a subject assignment for each teaching day.\n"
        "Return ONLY valid compact JSON on a single line — no markdown, no newlines inside JSON.\n"
        'Output: {"s":[{"d":"YYYY-MM-DD","sub":"subject name","ch":"chapter title"}]}\n'
        "\n"
        "Rules:\n"
        "1. One subject per day. Interleave by weekly_hours ratio.\n"
        "2. Cover chapters in order. Distribute proportionally.\n"
        "3. Return entries for ALL dates in the list.\n"
    )

    prompt = (
        f"Days: {json.dumps(sample_days)}\n"
        f"Subjects: {json.dumps([{'sub': s['subject'], 'hrs': s['weekly_hours'], 'chs': s['chapters'][:5]} for s in subjects_compact])}\n"
        f"Return compact JSON only."
    )

    try:
        result, provider = await _call_llm(prompt, system)
        logger.info(f"[planner] LLM ({provider}) generated schedule")

        s = result.find("{")
        e = result.rfind("}") + 1
        if s >= 0 and e > s:
            data = json.loads(result[s:e])
            schedule = data.get("schedule") or data.get("s") or []
            if schedule:
                # Build subject→chapter→topics lookup
                subject_topic_map = {}
                for subj in subjects_data:
                    name = subj.get("subject_name", "")
                    flat = []
                    for ch in (subj.get("chapters") or []):
                        ch_title = ch.get("title", "")
                        topics = ch.get("topics") or []
                        if topics:
                            for t in topics:
                                flat.append((ch_title, _topic_name(t)))
                        else:
                            flat.append((ch_title, ch_title))
                    subject_topic_map[name] = {"topics": flat, "ptr": 0, "hours": float(subj.get("weekly_hours") or 1), "id": subj.get("subject_id", "")}

                # Build schedule for sample days, then extend pattern to all days
                # First apply LLM schedule to sample days
                sample_set = set(sample_days)
                entries = []
                for item in schedule:
                    d = item.get("date") or item.get("d", "")
                    subj_name = item.get("subject") or item.get("sub", "")
                    if d not in sample_set or subj_name not in subject_topic_map:
                        continue
                    sm = subject_topic_map[subj_name]
                    ptr = sm["ptr"]
                    topics = sm["topics"]
                    if not topics:
                        continue
                    if ptr >= len(topics):
                        ptr = len(topics) - 1
                    ch_title, topic_name = topics[ptr]
                    sm["ptr"] = min(ptr + 1, len(topics) - 1)
                    duration = max(30, round(sm["hours"] * 60 / 5))
                    entries.append({
                        "date": d,
                        "subject_id": sm["id"],
                        "subject_name": subj_name,
                        "chapter_name": ch_title,
                        "topic_name": topic_name,
                        "duration_minutes": duration,
                    })

                # For remaining days beyond sample, use deterministic round-robin
                remaining_days = [td for td in teaching_days if td.isoformat() not in sample_set]
                if remaining_days:
                    # Rebuild subjects_data with updated topic pointers
                    remaining_subjects = []
                    for subj in subjects_data:
                        name = subj.get("subject_name", "")
                        sm = subject_topic_map.get(name, {})
                        ptr = sm.get("ptr", 0)
                        chapters = subj.get("chapters") or []
                        # Rebuild chapters with remaining topics only
                        remaining_topics_flat = sm.get("topics", [])[ptr:]
                        if remaining_topics_flat:
                            remaining_subjects.append({**subj, "_remaining_topics": remaining_topics_flat})
                    if remaining_subjects:
                        extra = _distribute_remaining(remaining_subjects, remaining_days)
                        entries.extend(extra)

                logger.info(f"[planner] LLM+deterministic produced {len(entries)} entries")
                return sorted(entries, key=lambda e: (e["date"], e["subject_name"]))
    except Exception as ex:
        logger.warning(f"[planner] LLM failed: {ex} — using deterministic distributor")

    return distribute_topics_across_days(subjects_data, teaching_days)


def _distribute_remaining(subjects_with_remaining, teaching_days):
    """Distribute remaining topics across days using weighted round-robin."""
    total_hours = sum(float(s.get("weekly_hours") or 1) for s in subjects_with_remaining)
    accum = [0.0] * len(subjects_with_remaining)
    ptrs = [0] * len(subjects_with_remaining)
    entries = []

    for day in teaching_days:
        for i, s in enumerate(subjects_with_remaining):
            accum[i] += float(s.get("weekly_hours") or 1) / total_hours
        best = max(range(len(subjects_with_remaining)), key=lambda i: accum[i])
        accum[best] -= 1.0

        topics = subjects_with_remaining[best].get("_remaining_topics") or []
        if not topics:
            continue
        ptr = min(ptrs[best], len(topics) - 1)
        ch_title, topic_name = topics[ptr]
        ptrs[best] = min(ptr + 1, len(topics) - 1)
        hours = float(subjects_with_remaining[best].get("weekly_hours") or 1)
        entries.append({
            "date": day.isoformat(),
            "subject_id": subjects_with_remaining[best].get("subject_id", ""),
            "subject_name": subjects_with_remaining[best].get("subject_name", ""),
            "chapter_name": ch_title,
            "topic_name": topic_name,
            "duration_minutes": max(30, round(hours * 60 / 5)),
        })
    return entries


def distribute_topics_across_days(subjects_data, teaching_days):
    """
    Deterministic weighted round-robin distributor.
    Interleaves subjects daily based on weekly_hours ratio.
    """
    if not teaching_days or not subjects_data:
        return []

    total_hours = sum(float(s.get("weekly_hours") or 1) for s in subjects_data)
    subject_ids = [s.get("subject_id", "") for s in subjects_data]
    subject_hours = [float(s.get("weekly_hours") or 1) for s in subjects_data]

    # Build flat topic list per subject
    subject_topics = []
    for s in subjects_data:
        topics = []
        for ch in (s.get("chapters") or []):
            ch_title = ch.get("title", "")
            ch_topics = ch.get("topics") or []
            if ch_topics:
                for t in ch_topics:
                    topics.append((ch_title, _topic_name(t)))
            else:
                topics.append((ch_title, ch_title))
        subject_topics.append(topics)

    ptrs = [0] * len(subjects_data)
    accum = [0.0] * len(subjects_data)
    entries = []

    for day in teaching_days:
        for i in range(len(subjects_data)):
            accum[i] += subject_hours[i] / total_hours
        best = max(range(len(subjects_data)), key=lambda i: accum[i])
        accum[best] -= 1.0

        topics = subject_topics[best]
        if not topics:
            continue
        ptr = min(ptrs[best], len(topics) - 1)
        ch_title, topic_name = topics[ptr]
        ptrs[best] = min(ptr + 1, len(topics) - 1)
        duration = max(30, round(subject_hours[best] * 60 / 5))

        entries.append({
            "date": day.isoformat(),
            "subject_id": subject_ids[best],
            "subject_name": subjects_data[best].get("subject_name", ""),
            "chapter_name": ch_title,
            "topic_name": topic_name,
            "duration_minutes": duration,
        })

    return sorted(entries, key=lambda e: (e["date"], e["subject_name"]))


def apply_carry_forward(entries, topic_index, subject_id, teaching_days):
    teaching_days_sorted = sorted(teaching_days)

    def next_td(d):
        return next((td for td in teaching_days_sorted if td > d), None)

    subj = sorted([e for e in entries if e.get("subject_id") == subject_id], key=lambda e: e["date"])
    other = [e for e in entries if e.get("subject_id") != subject_id]

    for i in range(topic_index, len(subj)):
        nd = next_td(date.fromisoformat(subj[i]["date"])) or date.fromisoformat(subj[i]["date"])
        subj[i] = {**subj[i], "date": nd.isoformat()}

    return sorted(other + subj, key=lambda e: (e["date"], e.get("subject_name", "")))
