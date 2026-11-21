-- Migration 112: Holistic Progress Report (NCFES-based)
-- Covers: Nursery, Jr. KG (Pre-1), Sr. KG (Pre-2)
-- Rating scale: E=Excellent, V=Very Good, G=Good, S=Satisfactory, P=Progressive

-- ── 1. Domain template — defines developmental assessment structure per class ──
-- One template per school+class+academic_year.
-- Each domain has a list of sub-items stored as JSONB array.
-- Sub-items CAN differ per class (Nursery vs Jr. KG vs Sr. KG).
CREATE TABLE IF NOT EXISTS holistic_report_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year   TEXT NOT NULL,
    domains         JSONB NOT NULL DEFAULT '[]',
    -- domains shape: [
    --   { id: "social_emotional", label: "Social / Emotional Development", sort_order: 1,
    --     sub_items: [{ id: "shares_turns", label: "Shares and takes turns", sort_order: 1 }, ...] },
    --   ...
    -- ]
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(school_id, class_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_hrt_school_class ON holistic_report_templates(school_id, class_id, academic_year);

-- ── 2. The actual report — one per student per term ──────────────────────────
CREATE TABLE IF NOT EXISTS holistic_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id              UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id              UUID NOT NULL REFERENCES sections(id),
    class_id                UUID NOT NULL REFERENCES classes(id),
    academic_year           TEXT NOT NULL,
    term                    TEXT NOT NULL CHECK (term IN ('mid_term', 'final_term')),
    teacher_id              UUID REFERENCES users(id),

    -- Developmental assessment grades
    -- Shape: { "social_emotional": { "shares_turns": "E", "confidence": "V" }, ... }
    developmental_ratings   JSONB NOT NULL DEFAULT '{}',

    -- Subject grades (pulled from curriculum_resources distinct subjects for this class)
    -- Shape: { "English": "E", "Maths": "V", "GK": "G" }
    subject_grades          JSONB NOT NULL DEFAULT '{}',

    -- Teacher comment
    teacher_comment_raw     TEXT,    -- original typed by teacher
    teacher_comment         TEXT,    -- Oakie-reformatted version

    -- Status
    status                  TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'shared')),
    shared_at               TIMESTAMPTZ,
    shared_by               UUID REFERENCES users(id),

    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),

    UNIQUE(student_id, academic_year, term)
);

CREATE INDEX IF NOT EXISTS idx_hr_student    ON holistic_reports(student_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_hr_section    ON holistic_reports(section_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_hr_school     ON holistic_reports(school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_hr_class      ON holistic_reports(class_id, academic_year, term);

-- ── 3. Seed default domain templates (placeholder — sub-items added by admin) ─
-- The 6 domains are the same for all classes; sub-items will differ.
-- We store an empty sub_items array that admin fills in.
-- This is just the domain scaffold — no seeding of school-specific rows here.

COMMENT ON TABLE holistic_report_templates IS
  'Stores the developmental assessment domain structure per class. Admin configures sub-items per domain. Sub-items can differ between Nursery, Jr. KG, and Sr. KG.';

COMMENT ON TABLE holistic_reports IS
  'One holistic progress report per student per term (mid_term / final_term). Stores developmental ratings, subject grades, and teacher comment. Shared to parent via messages table.';
