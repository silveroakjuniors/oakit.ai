CREATE TABLE curriculum_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    checksum        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    total_chunks    INT,
    failed_pages    JSONB DEFAULT '[]',
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(class_id, checksum)
);

CREATE TABLE curriculum_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    document_id     UUID NOT NULL REFERENCES curriculum_documents(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    topic_label     TEXT,
    content         TEXT NOT NULL,
    page_start      INT,
    page_end        INT,
    activity_ids    TEXT[] DEFAULT '{}',
    embedding       vector(384),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON curriculum_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON curriculum_chunks(class_id, chunk_index);
CREATE INDEX ON curriculum_chunks(document_id);
CREATE INDEX ON curriculum_documents(school_id, class_id);
