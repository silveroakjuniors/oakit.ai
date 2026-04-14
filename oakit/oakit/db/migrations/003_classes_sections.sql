CREATE TABLE classes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    UNIQUE(school_id, name)
);

CREATE TABLE sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    UNIQUE(class_id, label)
);

CREATE TABLE teacher_sections (
    teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_id  UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, section_id)
);

CREATE INDEX ON classes(school_id);
CREATE INDEX ON sections(class_id);
CREATE INDEX ON teacher_sections(teacher_id);
CREATE INDEX ON teacher_sections(section_id);
