-- Migration 031: Developmental milestones
CREATE TABLE IF NOT EXISTS milestones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL = global predefined
    class_level TEXT NOT NULL CHECK (class_level IN ('Play Group','Nursery','LKG','UKG')),
    domain      TEXT NOT NULL CHECK (domain IN ('Cognitive','Social','Motor','Language','Other')),
    description TEXT NOT NULL,
    is_custom   BOOLEAN NOT NULL DEFAULT false,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milestones_level ON milestones(class_level);

CREATE TABLE IF NOT EXISTS student_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    milestone_id    UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    achieved_at     DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (student_id, milestone_id)
);
CREATE INDEX IF NOT EXISTS idx_student_milestones_student ON student_milestones(student_id);

-- Seed predefined milestones (global, school_id = NULL)
INSERT INTO milestones (school_id, class_level, domain, description, position) VALUES
-- Play Group (age ~2-3)
(NULL,'Play Group','Cognitive','Identifies and names at least 3 colours',1),
(NULL,'Play Group','Cognitive','Matches objects by shape (circle, square, triangle)',2),
(NULL,'Play Group','Cognitive','Completes a simple 4-piece puzzle',3),
(NULL,'Play Group','Language','Uses 2-word phrases to communicate needs',4),
(NULL,'Play Group','Language','Follows simple 2-step instructions',5),
(NULL,'Play Group','Language','Points to and names familiar objects in pictures',6),
(NULL,'Play Group','Social','Takes turns in simple group activities',7),
(NULL,'Play Group','Social','Plays alongside other children (parallel play)',8),
(NULL,'Play Group','Motor','Holds a crayon and makes marks on paper',9),
(NULL,'Play Group','Motor','Walks up and down stairs with support',10),
(NULL,'Play Group','Motor','Kicks a ball forward',11),
-- Nursery (age ~3-4)
(NULL,'Nursery','Cognitive','Counts objects up to 5 correctly',1),
(NULL,'Nursery','Cognitive','Identifies basic shapes: circle, square, triangle, rectangle',2),
(NULL,'Nursery','Cognitive','Sorts objects by colour and size',3),
(NULL,'Nursery','Language','Speaks in 3-4 word sentences',4),
(NULL,'Nursery','Language','Recites a short nursery rhyme from memory',5),
(NULL,'Nursery','Language','Recognises own name in print',6),
(NULL,'Nursery','Social','Shares toys and materials with peers',7),
(NULL,'Nursery','Social','Follows classroom rules with reminders',8),
(NULL,'Nursery','Motor','Holds pencil with tripod grip',9),
(NULL,'Nursery','Motor','Cuts along a straight line with scissors',10),
(NULL,'Nursery','Motor','Hops on one foot for 3 seconds',11),
-- LKG (age ~4-5)
(NULL,'LKG','Cognitive','Counts and writes numbers 1–10',1),
(NULL,'LKG','Cognitive','Identifies and writes uppercase letters A–Z',2),
(NULL,'LKG','Cognitive','Understands concepts: big/small, more/less, before/after',3),
(NULL,'LKG','Language','Speaks in complete sentences of 5+ words',4),
(NULL,'LKG','Language','Retells a short story in sequence',5),
(NULL,'LKG','Language','Recognises and reads 10 sight words',6),
(NULL,'LKG','Social','Resolves minor conflicts with peers independently',7),
(NULL,'LKG','Social','Participates actively in group activities',8),
(NULL,'LKG','Motor','Writes own name legibly',9),
(NULL,'LKG','Motor','Draws a person with at least 4 body parts',10),
(NULL,'LKG','Motor','Skips and gallops with coordination',11),
-- UKG (age ~5-6)
(NULL,'UKG','Cognitive','Counts and writes numbers 1–50',1),
(NULL,'UKG','Cognitive','Reads and writes lowercase letters a–z',2),
(NULL,'UKG','Cognitive','Performs simple addition and subtraction within 10',3),
(NULL,'UKG','Language','Reads simple 3-letter CVC words (cat, dog, sun)',4),
(NULL,'UKG','Language','Writes simple sentences with a capital letter and full stop',5),
(NULL,'UKG','Language','Expresses ideas clearly in a short paragraph (spoken)',6),
(NULL,'UKG','Social','Works cooperatively in a group project',7),
(NULL,'UKG','Social','Shows empathy and helps peers in need',8),
(NULL,'UKG','Motor','Writes all letters and numbers with correct formation',9),
(NULL,'UKG','Motor','Uses scissors to cut along curved lines',10),
(NULL,'UKG','Motor','Catches a ball thrown from 2 metres',11)
ON CONFLICT DO NOTHING;
