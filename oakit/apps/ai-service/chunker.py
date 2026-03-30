from dataclasses import dataclass, field
from extractor import DayEntry, PageText
import re

ACTIVITY_PATTERN = re.compile(r'\b(\d{4})\b')

@dataclass
class Chunk:
    content: str
    topic_label: str
    page_start: int
    page_end: int
    week: int = 0
    day: int = 0
    activity_ids: list = field(default_factory=list)

def chunk_from_days(day_entries):
    chunks = []
    for entry in day_entries:
        content = entry.content
        if not content.strip():
            continue
        chunks.append(Chunk(
            content=content,
            topic_label=entry.topic_label,
            page_start=entry.page_num,
            page_end=entry.page_num,
            week=entry.week,
            day=entry.day,
            activity_ids=entry.activity_ids,
        ))
    return chunks

def chunk_document(pages):
    MAX_CHUNK_TOKENS = 400
    MIN_CHUNK_TOKENS = 50
    HEADING_PATTERN = re.compile(r'^(#{1,3}\s|[A-Z][A-Z\s]{3,}:|Day\s+\d+|Week\s+\d+|\d+\.\s+[A-Z])', re.MULTILINE)
    def _token_count(text): return len(text.split())
    chunks = []
    current_lines = []
    current_topic = "Introduction"
    current_page_start = pages[0].page_num if pages else 1
    def flush(page_end):
        nonlocal current_lines, current_topic, current_page_start
        text = "\n".join(current_lines).strip()
        if _token_count(text) >= MIN_CHUNK_TOKENS:
            ids = list(set(ACTIVITY_PATTERN.findall(text)))
            chunks.append(Chunk(content=text, topic_label=current_topic, page_start=current_page_start, page_end=page_end, activity_ids=ids))
        current_lines.clear()
        current_page_start = page_end
    for page in pages:
        for line in page.text.split("\n"):
            stripped = line.strip()
            if not stripped: continue
            if HEADING_PATTERN.match(stripped) and _token_count("\n".join(current_lines)) >= MIN_CHUNK_TOKENS:
                flush(page.page_num)
                current_topic = stripped[:80]
            current_lines.append(line)
            if _token_count("\n".join(current_lines)) >= MAX_CHUNK_TOKENS:
                flush(page.page_num)
    if current_lines:
        text = "\n".join(current_lines).strip()
        if text:
            chunks.append(Chunk(content=text, topic_label=current_topic, page_start=current_page_start, page_end=pages[-1].page_num if pages else current_page_start, activity_ids=list(set(ACTIVITY_PATTERN.findall(text)))))
    return chunks