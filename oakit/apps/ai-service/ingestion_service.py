import json
from uuid import UUID
from db import get_pool
from extractor import extract_days, extract_pages
from chunker import chunk_from_days, chunk_document, Chunk
from embeddings import embed_batch


async def _set_stage(pool, document_id: UUID, stage: str):
    await pool.execute(
        "UPDATE curriculum_documents SET ingestion_stage = $1 WHERE id = $2",
        stage, document_id
    )


async def ingest_document(document_id: str) -> dict:
    pool = await get_pool()

    doc = await pool.fetchrow(
        "SELECT id, file_path, class_id, school_id, start_page FROM curriculum_documents WHERE id = $1",
        UUID(document_id)
    )
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    await pool.execute(
        "UPDATE curriculum_documents SET status = 'processing', ingestion_stage = 'extracting' WHERE id = $1",
        UUID(document_id)
    )

    start_page = doc["start_page"] or 1

    try:
        # Stage: extracting
        await _set_stage(pool, UUID(document_id), 'extracting')
        day_entries, failed_pages = extract_days(doc["file_path"], start_page=start_page)

        if day_entries:
            # Stage: chunking
            await _set_stage(pool, UUID(document_id), 'chunking')
            chunks: list[Chunk] = chunk_from_days(day_entries)
            print(f"Table extraction: {len(day_entries)} day entries → {len(chunks)} chunks")
        else:
            print("No tables found, falling back to text extraction")
            pages, failed_pages = extract_pages(doc["file_path"], start_page=start_page)
            if not pages:
                await pool.execute(
                    "UPDATE curriculum_documents SET status = 'failed', ingestion_stage = 'failed', failed_pages = $1 WHERE id = $2",
                    json.dumps(failed_pages), UUID(document_id)
                )
                return {"chunks_created": 0, "failed_pages": failed_pages}
            # Stage: chunking
            await _set_stage(pool, UUID(document_id), 'chunking')
            chunks = chunk_document(pages)

        if not chunks:
            await pool.execute(
                "UPDATE curriculum_documents SET status = 'failed', ingestion_stage = 'failed' WHERE id = $1",
                UUID(document_id)
            )
            return {"chunks_created": 0, "failed_pages": failed_pages}

        # Stage: embedding
        await _set_stage(pool, UUID(document_id), 'embedding')
        texts = [c.content for c in chunks]
        embeddings = embed_batch(texts)

        # Delete existing chunks
        await pool.execute(
            "DELETE FROM curriculum_chunks WHERE document_id = $1",
            UUID(document_id)
        )

        # Insert chunks
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            await pool.execute(
                """INSERT INTO curriculum_chunks
                   (school_id, document_id, class_id, chunk_index, topic_label, content,
                    page_start, page_end, activity_ids, embedding)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)""",
                doc["school_id"], UUID(document_id), doc["class_id"],
                i, chunk.topic_label, chunk.content,
                chunk.page_start, chunk.page_end,
                chunk.activity_ids,
                str(embedding)
            )

        # Stage: done
        await pool.execute(
            """UPDATE curriculum_documents
               SET status = 'ready', ingestion_stage = 'done', total_chunks = $1, failed_pages = $2
               WHERE id = $3""",
            len(chunks), json.dumps(failed_pages), UUID(document_id)
        )

        return {"chunks_created": len(chunks), "failed_pages": failed_pages}

    except Exception as e:
        await pool.execute(
            "UPDATE curriculum_documents SET status = 'failed', ingestion_stage = 'failed' WHERE id = $1",
            UUID(document_id)
        )
        raise e
