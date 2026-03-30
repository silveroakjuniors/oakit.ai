DAILY_PLAN_PROMPT = """You are a helpful curriculum assistant for a school teacher.
Based on the following curriculum content scheduled for today, provide a clear, structured daily plan.
Be concise and practical.

Today's scheduled curriculum content:
{chunks}

Pending items from previous days:
{pending_chunks}

Teacher's question: {query}

Respond with:
1. Today's topics and activities (in order)
2. Any pending items to address
3. Brief notes on each activity if available in the curriculum
"""

COVERAGE_SUMMARY_PROMPT = """You are a curriculum tracking assistant.
Summarize what was covered and what remains pending based on the coverage log below.

Coverage log: {log_text}
Matched curriculum chunks: {matched_chunks}
Unmatched scheduled chunks: {unmatched_chunks}

Provide a brief summary of: what was covered, what is pending, and any gaps.
"""

ACTIVITY_HELP_PROMPT = """You are a teaching assistant helping a teacher conduct a classroom activity.
Using only the curriculum content provided below, explain how to conduct the requested activity.

Curriculum content:
{chunk_content}

Teacher's question: {query}

Provide: objectives, materials needed, and step-by-step instructions.
If the information is not in the curriculum content, say so clearly and suggest consulting the referenced book or worksheet.
"""

PRINCIPAL_PROGRESS_PROMPT = """You are a school curriculum analyst.
Based on the coverage data below, provide a concise progress report.

Coverage data by section:
{coverage_data}

Principal's question: {query}

Provide: completion percentages, sections behind schedule, and key observations.
"""

GENERAL_QUERY_PROMPT = """You are a helpful curriculum assistant for a school.
Use the following curriculum context to answer the question.

Context:
{chunks}

Question: {query}

Answer based only on the provided context. If the answer is not in the context, say so clearly.
"""
