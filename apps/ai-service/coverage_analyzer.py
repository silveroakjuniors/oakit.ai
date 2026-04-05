from uuid import UUID
from db import get_pool
from embeddings import embed, cosine_similarity

COVERED_THRESHOLD = 0.75
PARTIAL_THRESHOLD = 0.45

async def analyze_coverage(coverage_log_id: str, log_text: str, section_id: str, log_date: str) -> list[dict]:
    pool = await get_pool()

    # Get day plan chunk IDs
    plan = await pool.fetchrow(
        "SELECT chunk_ids FROM day_plans WHERE section_id = $1 AND plan_date = $2",
        UUID(section_id), log_date
    )
    if not plan or not plan["chunk_ids"]:
        return []

    chunk_ids = plan["chunk_ids"]

    # Embed the log text
    log_embedding = embed(log_text)

    # Fetch chunk embeddings
    chunks = await pool.fetch(
        "SELECT id, embedding::text FROM curriculum_chunks WHERE id = ANY($1::uuid[])",
        chunk_ids
    )

    results = []
    for chunk in chunks:
        # Parse embedding from postgres vector string
        emb_str = chunk["embedding"].strip("[]")
        chunk_embedding = [float(x) for x in emb_str.split(",")]
        score = cosine_similarity(log_embedding, chunk_embedding)

        if score >= COVERED_THRESHOLD:
            status = "covered"
        elif score >= PARTIAL_THRESHOLD:
            status = "partial"
        else:
            status = "pending"

        results.append({
            "chunk_id": str(chunk["id"]),
            "status": status,
            "similarity_score": score,
        })

    # Insert coverage statuses
    for r in results:
        await pool.execute(
            """INSERT INTO coverage_statuses (coverage_log_id, chunk_id, status, similarity_score)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (coverage_log_id, chunk_id) DO UPDATE
               SET status = EXCLUDED.status, similarity_score = EXCLUDED.similarity_score""",
            UUID(coverage_log_id), UUID(r["chunk_id"]), r["status"], r["similarity_score"]
        )

    # Flag log if all pending
    all_pending = all(r["status"] == "pending" for r in results)
    if all_pending and results:
        await pool.execute(
            "UPDATE coverage_logs SET flagged = true WHERE id = $1",
            UUID(coverage_log_id)
        )

    # Carry forward pending chunks
    pending_ids = [r["chunk_id"] for r in results if r["status"] == "pending"]
    if pending_ids:
        from planner_service import carry_forward_pending
        await carry_forward_pending(section_id, log_date, pending_ids)

    return results
