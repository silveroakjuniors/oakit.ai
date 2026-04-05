import pdfplumber
from dataclasses import dataclass, field

@dataclass
class PageText:
    page_num: int
    text: str  # kept for backward compat

@dataclass
class DayEntry:
    week: int
    day: int
    page_num: int
    subjects: dict = field(default_factory=dict)  # {subject_name: activity_text}

    @property
    def content(self) -> str:
        lines = []
        for subject, activity in self.subjects.items():
            if activity and activity.strip():
                lines.append(f"{subject}: {activity.strip()}")
        return "\n".join(lines)

    @property
    def topic_label(self) -> str:
        return f"Week {self.week} Day {self.day}"

    @property
    def activity_ids(self) -> list:
        import re
        pattern = re.compile(r'\b(\d{4})\b')
        ids = []
        for v in self.subjects.values():
            ids.extend(pattern.findall(v or ""))
        return list(set(ids))


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return " ".join(text.split())


def _parse_week_day_header(cell: str) -> tuple[int | None, int | None]:
    """Extract week and day numbers from a header cell like 'UKG Week 1 : Subject' or 'Day 3'"""
    import re
    if not cell:
        return None, None
    week_match = re.search(r'[Ww]eek\s*(\d+)', cell)
    day_match = re.search(r'[Dd]ay\s*(\d+)', cell)
    week = int(week_match.group(1)) if week_match else None
    day = int(day_match.group(1)) if day_match else None
    return week, day


def extract_days(file_path: str, start_page: int = 1) -> tuple[list[DayEntry], list[dict]]:
    """
    Extract structured day entries from a table-based curriculum PDF.

    Handles two table formats:
    1. Subject column present: | Subject | Day 1 | Day 2 |
       Header col 0 = "UKG Week 1 : Subject", col 1+ = "Day N"
    2. No subject column (split-page): | Day 3 | Day 4 | Day 5 |
       Header col 0 = "UKG Week 1 : Day 3", all cols are data
       Subjects are carried over from the most recent table that had them.
    """
    days: list[DayEntry] = []
    failed: list[dict] = []

    # Carry subject names across pages — key = week number, value = ordered list of subject names
    week_subjects: dict[int, list[str]] = {}

    try:
        with pdfplumber.open(file_path) as pdf:
            total = len(pdf.pages)
            for page_num in range(start_page - 1, total):
                page = pdf.pages[page_num]
                real_page = page_num + 1

                try:
                    tables = page.extract_tables()
                    if not tables:
                        continue

                    for table in tables:
                        if not table or len(table) < 2:
                            continue

                        header_row = table[0]
                        if not header_row:
                            continue

                        # Parse each header cell for week/day numbers
                        col_week: list[int | None] = []
                        col_day: list[int | None] = []
                        current_week: int | None = None

                        for cell in header_row:
                            cell_text = _clean(cell)
                            week, day = _parse_week_day_header(cell_text)
                            if week:
                                current_week = week
                            col_week.append(current_week)
                            col_day.append(day)

                        # Skip non-curriculum tables
                        if not any(d for d in col_day if d is not None):
                            continue

                        # Determine table format
                        first_col_has_day = col_day[0] is not None

                        day_map: dict[tuple, DayEntry] = {}

                        if not first_col_has_day:
                            # FORMAT 1: col 0 = subject name, col 1+ = day data
                            # Learn and store subject order for this week
                            subjects_this_table: list[str] = []
                            for row in table[1:]:
                                if not row or len(row) < 2:
                                    continue
                                subject = _clean(row[0])
                                if not subject:
                                    continue
                                subjects_this_table.append(subject)

                                for col_idx in range(1, len(row)):
                                    week_num = col_week[col_idx] if col_idx < len(col_week) else current_week
                                    day_num = col_day[col_idx] if col_idx < len(col_day) else None
                                    if not week_num or not day_num:
                                        continue
                                    key = (week_num, day_num)
                                    if key not in day_map:
                                        day_map[key] = DayEntry(week=week_num, day=day_num, page_num=real_page)
                                    cell_text = _clean(row[col_idx]) if col_idx < len(row) else ""
                                    if cell_text:
                                        day_map[key].subjects[subject] = cell_text

                            # Store subject order for this week
                            if current_week and subjects_this_table:
                                week_subjects[current_week] = subjects_this_table

                        else:
                            # FORMAT 2: all columns are day data (no subject column)
                            # Reuse subject names from the same week's previous table
                            known_subjects = week_subjects.get(current_week or 0, [])

                            for row_idx, row in enumerate(table[1:]):
                                if not row:
                                    continue
                                # Map row position to subject name if available
                                subject = known_subjects[row_idx] if row_idx < len(known_subjects) else f"Activity {row_idx + 1}"

                                for col_idx in range(len(row)):
                                    week_num = col_week[col_idx] if col_idx < len(col_week) else current_week
                                    day_num = col_day[col_idx] if col_idx < len(col_day) else None
                                    if not week_num or not day_num:
                                        continue
                                    key = (week_num, day_num)
                                    if key not in day_map:
                                        day_map[key] = DayEntry(week=week_num, day=day_num, page_num=real_page)
                                    cell_text = _clean(row[col_idx]) if col_idx < len(row) else ""
                                    if cell_text:
                                        day_map[key].subjects[subject] = cell_text

                        days.extend(day_map.values())

                except Exception as e:
                    failed.append({"page": real_page, "reason": str(e)})

    except Exception as e:
        failed.append({"page": 0, "reason": f"Could not open PDF: {e}"})

    # Sort by week then day
    days.sort(key=lambda d: (d.week, d.day))
    return days, failed


# Backward-compatible plain text extraction (used as fallback)
def extract_pages(file_path: str, start_page: int = 1) -> tuple[list[PageText], list[dict]]:
    pages: list[PageText] = []
    failed: list[dict] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for i in range(start_page - 1, len(pdf.pages)):
                page = pdf.pages[i]
                real_page = i + 1
                try:
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append(PageText(page_num=real_page, text=text))
                    else:
                        failed.append({"page": real_page, "reason": "No extractable text"})
                except Exception as e:
                    failed.append({"page": real_page, "reason": str(e)})
    except Exception as e:
        failed.append({"page": 0, "reason": f"Could not open PDF: {e}"})
    return pages, failed
