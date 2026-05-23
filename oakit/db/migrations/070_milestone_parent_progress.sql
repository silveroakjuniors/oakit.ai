-- Migration 070: Milestone parent visibility + progress notes

-- Allow milestones to be shared with parents (default true for all)
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS shared_with_parent BOOLEAN NOT NULL DEFAULT true;

-- Add parent progress tracking to student_milestones
ALTER TABLE student_milestones
  ADD COLUMN IF NOT EXISTS parent_note TEXT,
  ADD COLUMN IF NOT EXISTS parent_noted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Expand domain check to include new domains
ALTER TABLE milestones
  DROP CONSTRAINT IF EXISTS milestones_domain_check;

ALTER TABLE milestones
  ADD CONSTRAINT milestones_domain_check
  CHECK (domain IN ('Cognitive','Social','Motor','Language','Other',
                    'Emotional','GrossMotor','FineMotor','Creativity',
                    'Participation','Peer','Behaviour'));
