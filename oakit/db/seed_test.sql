-- OAKIT TEST SEED v4
-- Paste this entire file into Supabase SQL Editor and run
-- Includes migrations 021, 022, 023 inline so you only need to run one file

-- MIGRATION 021: Supplementary Activity Pools
CREATE TABLE IF NOT EXISTS activity_pools (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT,language TEXT NOT NULL DEFAULT 'English',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE (school_id, name));
CREATE INDEX IF NOT EXISTS idx_activity_pools_school ON activity_pools(school_id);
CREATE TABLE IF NOT EXISTS activities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),activity_pool_id UUID NOT NULL REFERENCES activity_pools(id) ON DELETE CASCADE,school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT,position INT NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE (activity_pool_id, title));
CREATE INDEX IF NOT EXISTS idx_activities_pool ON activities(activity_pool_id);
CREATE TABLE IF NOT EXISTS pool_assignments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,activity_pool_id UUID NOT NULL REFERENCES activity_pools(id) ON DELETE CASCADE,class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,frequency_mode TEXT NOT NULL CHECK (frequency_mode IN ('weekly', 'interval')),interval_days INT CHECK (interval_days >= 1 AND interval_days <= 30),start_date DATE NOT NULL,end_date DATE NOT NULL,carry_forward_on_miss BOOLEAN NOT NULL DEFAULT false,is_deleted BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE (activity_pool_id, class_id));
CREATE INDEX IF NOT EXISTS idx_pool_assignments_school ON pool_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_pool_assignments_class ON pool_assignments(class_id);
CREATE TABLE IF NOT EXISTS supplementary_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,pool_assignment_id UUID NOT NULL REFERENCES pool_assignments(id) ON DELETE CASCADE,activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,plan_date DATE NOT NULL,status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','skipped','replaced')),override_note TEXT,original_date DATE,completed_at TIMESTAMPTZ,completed_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE (section_id, pool_assignment_id, plan_date));
CREATE INDEX IF NOT EXISTS idx_supplementary_plans_section_date ON supplementary_plans(section_id, plan_date);
CREATE TABLE IF NOT EXISTS supplementary_rotation_cursors (section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,pool_assignment_id UUID NOT NULL REFERENCES pool_assignments(id) ON DELETE CASCADE,next_position INT NOT NULL DEFAULT 0,PRIMARY KEY (section_id, pool_assignment_id));

-- MIGRATION 022: Role portal access
ALTER TABLE roles ADD COLUMN IF NOT EXISTS portal_access TEXT CHECK (portal_access IN ('admin','principal','teacher','parent'));

-- MIGRATION 023: Attendance late tracking
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMPTZ;

-- MIGRATION 024: Mother info on students
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_contact TEXT;

BEGIN;

-- 1. CLEAR
DELETE FROM parent_notifications;
DELETE FROM supplementary_plans;
DELETE FROM supplementary_rotation_cursors;
DELETE FROM pool_assignments;
DELETE FROM activities;
DELETE FROM activity_pools;
DELETE FROM missed_topic_tasks;
DELETE FROM daily_completions;
DELETE FROM attendance_records;
DELETE FROM parent_student_links;
DELETE FROM parent_users;
DELETE FROM teacher_sections;
DELETE FROM students;
DELETE FROM special_days;
DELETE FROM holidays;
DELETE FROM school_calendar;

-- 2. SCHOOL
INSERT INTO schools (id,name,subdomain,contact,status,plan_type,billing_status)
VALUES ('a0000000-0000-0000-0000-000000000001','Silveroak Juniors','sojs','{"email":"admin@sojs.edu"}','active','premium','active')
ON CONFLICT (subdomain) DO UPDATE SET status='active',plan_type='premium';

-- 3. CLASSES
INSERT INTO classes (id,school_id,name,day_start_time,day_end_time) VALUES
  ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Play Group','09:00','12:00'),
  ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Nursery','09:00','12:30'),
  ('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','LKG','09:00','13:00'),
  ('d0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','UKG','09:00','13:00')
ON CONFLICT (school_id,name) DO UPDATE SET day_start_time=EXCLUDED.day_start_time,day_end_time=EXCLUDED.day_end_time;

-- 4. SECTIONS
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','A' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000001' AND label='A');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','A' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='A');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','B' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='B');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','A' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='A');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','B' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='B');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004','A' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='A');
INSERT INTO sections (school_id,class_id,label) SELECT 'a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004','B' WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='B');


-- 5. ROLES
INSERT INTO roles (id,school_id,name,permissions,portal_access) VALUES
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','admin','["read:all","write:all","manage:users","manage:classes","manage:curriculum","manage:calendar"]','admin'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','principal','["read:all","read:dashboard","query:ai"]','principal'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','teacher','["read:own_plan","write:coverage_log","query:ai","mark:attendance"]','teacher'),
  ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Center Head','["read:all","read:dashboard","query:ai"]','principal'),
  ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Accountant','["read:all"]','admin')
ON CONFLICT (school_id,name) DO UPDATE SET portal_access=EXCLUDED.portal_access,permissions=EXCLUDED.permissions;

-- 6. USERS
INSERT INTO users (id,school_id,role_id,name,mobile,email,password_hash,is_active,force_password_reset) VALUES
  ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','School Admin','9999999999','admin@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','Sushma Rao','8888888888','sush@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','Priya Nair','8777777777','priya@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Anita Sharma','8111111111','anita@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Meena Pillai','8222222222','meena@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Kavitha Reddy','8333333333','kavitha@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Deepa Menon','8444444444','deepa@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Sunita Joshi','8555555555','sunita@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Test Teacher','8666666666','test@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Rekha Iyer','8777777770','rekha@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Pooja Singh','8999999999','pooja@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false),
  ('c0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','Ravi Kumar','7000000001','ravi@sojs.edu','$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',true,false)
ON CONFLICT (school_id,mobile) DO UPDATE SET name=EXCLUDED.name,role_id=EXCLUDED.role_id,password_hash=EXCLUDED.password_hash,force_password_reset=false,is_active=true;

-- 7. CLASS TEACHERS
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000004' WHERE class_id='d0000000-0000-0000-0000-000000000001' AND label='A';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000005' WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='A';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000006' WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='B';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000007' WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='A';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000008' WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='B';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000009' WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='A';
UPDATE sections SET class_teacher_id='c0000000-0000-0000-0000-000000000010' WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='B';

-- 8. SUPPORTING TEACHER
INSERT INTO teacher_sections (teacher_id,section_id) SELECT 'c0000000-0000-0000-0000-000000000011',id FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='A' ON CONFLICT DO NOTHING;
INSERT INTO teacher_sections (teacher_id,section_id) SELECT 'c0000000-0000-0000-0000-000000000011',id FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='A' ON CONFLICT DO NOTHING;

-- 9. CALENDAR
INSERT INTO school_calendar (school_id,academic_year,working_days,start_date,end_date,holidays)
VALUES ('a0000000-0000-0000-0000-000000000001','2026-27',ARRAY[1,2,3,4,5],'2026-06-01','2027-03-26',ARRAY[]::DATE[])
ON CONFLICT (school_id,academic_year) DO UPDATE SET working_days=EXCLUDED.working_days,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date;

-- 10. HOLIDAYS
-- (Upload your holidays via Calendar → Import xlsx)
-- No holidays seeded — use the import feature to upload your holiday list

-- 11. SPECIAL DAYS — 2 weeks settling period (Mon-Fri only) for all classes
-- Week 1: June 1-5 2026, Week 2: June 8-12 2026
INSERT INTO special_days (school_id,academic_year,day_date,day_type,label,activity_note,duration_type) VALUES
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-01','settling','Term 1 Settling Period','Welcome children, classroom tour, free play, name games',  'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-02','settling','Term 1 Settling Period','Morning routine, circle time, simple activities, class rules','full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-03','settling','Term 1 Settling Period','Guided activity, short lesson, outdoor play, goodbye routine','full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-04','settling','Term 1 Settling Period','Introduce more structure, short curriculum tasters',          'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-05','settling','Term 1 Settling Period','Build confidence, near-normal routine, fun activities',       'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-08','settling','Term 1 Settling Period','Week 2 settling — reinforce routines, circle time games',     'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-09','settling','Term 1 Settling Period','Week 2 — introduce first curriculum topics gently',           'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-10','settling','Term 1 Settling Period','Week 2 — structured play, short lessons, group activities',   'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-11','settling','Term 1 Settling Period','Week 2 — children comfortable, begin regular schedule',       'full_day'),
  ('a0000000-0000-0000-0000-000000000001','2026-27','2026-06-12','settling','Term 1 Settling Period','Final settling day — full routine, children ready for Term 1','full_day')
ON CONFLICT (school_id,academic_year,day_date) DO NOTHING;


-- 12. STUDENTS
DO $$
DECLARE
  pg_a UUID; nur_a UUID; nur_b UUID; lkg_a UUID; lkg_b UUID; ukg_a UUID; ukg_b UUID;
BEGIN
  SELECT id INTO pg_a  FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000001' AND label='A';
  SELECT id INTO nur_a FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='A';
  SELECT id INTO nur_b FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000002' AND label='B';
  SELECT id INTO lkg_a FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='A';
  SELECT id INTO lkg_b FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='B';
  SELECT id INTO ukg_a FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='A';
  SELECT id INTO ukg_b FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='B';
  INSERT INTO students (school_id,class_id,section_id,name,father_name,parent_contact,is_active) VALUES
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',pg_a,'Aarav Sharma','Rajesh Sharma','9900000001',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',pg_a,'Diya Patel','Suresh Patel','9900000006',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',pg_a,'Rohan Nair','Vijay Nair',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',pg_a,'Ananya Reddy','Kiran Reddy',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',pg_a,'Kabir Singh','Manish Singh',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_a,'Ishaan Mehta','Amit Mehta','9900000002',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_a,'Priya Joshi','Deepak Joshi',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_a,'Arjun Kumar','Sanjay Kumar','9900000006',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_a,'Saanvi Iyer','Ravi Iyer',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_b,'Myra Gupta','Rahul Gupta',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_b,'Aditya Rao','Suresh Rao',null,true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',nur_b,'Kiara Menon','Arun Menon',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_a,'Riya Verma','Anil Verma',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_a,'Arnav Bose','Subhash Bose',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_a,'Tara Nair','Mohan Nair',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_a,'Sai Reddy','Venkat Reddy',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_a,'Nisha Patel','Dinesh Patel',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_b,'Vivaan Shah','Paresh Shah',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',lkg_b,'Anika Jain','Rakesh Jain',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_a,'Advait Sharma','Rohit Sharma',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_a,'Zara Ahmed','Farhan Ahmed',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_a,'Krish Menon','Ajay Menon',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_a,'Mia DSouza','Peter DSouza',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_a,'Yash Gupta','Vikram Gupta',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_b,'Ira Kapoor','Aakash Kapoor',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_b,'Neil Mathur','Sunil Mathur',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_b,'Sia Pillai','Rajan Pillai',true),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',ukg_b,'Aryan Bhat','Suresh Bhat',true);
END $$;

-- 13. PARENTS
-- Password for all parents = their own mobile number
-- Hash below = bcrypt of '9900000001', '9900000002', etc.
-- We use a single known hash: $2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe = hash of '9999999999'
-- For simplicity all test parents use password = 9900000001 (same hash trick — see note below)
-- IMPORTANT: Run this after seeding to fix hashes:
--   UPDATE parent_users SET password_hash = crypt(mobile, gen_salt('bf')) WHERE school_id = 'a0000000-0000-0000-0000-000000000001';
-- OR use the activate-parent endpoint from Admin UI which sets password = mobile correctly.

-- Test parents with mobile as password (hash of mobile stored correctly via pgcrypto):
INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001','9900000001','Rajesh Sharma',
   crypt('9900000001', gen_salt('bf')), false, true),
  ('a0000000-0000-0000-0000-000000000001','9900000002','Amit Mehta',
   crypt('9900000002', gen_salt('bf')), false, true),
  ('a0000000-0000-0000-0000-000000000001','9900000003','Anil Verma',
   crypt('9900000003', gen_salt('bf')), false, true),
  ('a0000000-0000-0000-0000-000000000001','9900000004','Rohit Sharma',
   crypt('9900000004', gen_salt('bf')), false, true),
  ('a0000000-0000-0000-0000-000000000001','9900000005','Farhan Ahmed',
   crypt('9900000005', gen_salt('bf')), false, true),
  -- Twin parent: Suresh Patel has twins Diya (PG-A) and Arjun (Nur-A)
  ('a0000000-0000-0000-0000-000000000001','9900000006','Suresh Patel',
   crypt('9900000006', gen_salt('bf')), false, true)
ON CONFLICT (school_id, mobile) DO UPDATE
  SET password_hash = crypt(EXCLUDED.mobile, gen_salt('bf')),
      is_active = true, force_password_reset = false, name = EXCLUDED.name;

-- 14. PARENT-STUDENT LINKS
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000001' AND st.name='Aarav Sharma' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000002' AND st.name='Ishaan Mehta' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000003' AND st.name='Riya Verma' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000004' AND st.name='Advait Sharma' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000005' AND st.name='Zara Ahmed' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
-- Twin parent: Suresh Patel linked to BOTH Diya Patel (PG-A) and Arjun Kumar (Nur-A) — tests multi-child switcher
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000006' AND st.name='Diya Patel' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO parent_student_links (parent_id,student_id) SELECT pu.id,st.id FROM parent_users pu,students st WHERE pu.mobile='9900000006' AND st.name='Arjun Kumar' AND st.school_id='a0000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;


-- 15. ATTENDANCE + COMPLETIONS (no new columns — works on base schema)
DO $$
DECLARE
  ukg_a UUID; lkg_a UUID;
  test_teacher UUID; deepa UUID;
  advait_id UUID; zara_id UUID; krish_id UUID; mia_id UUID; yash_id UUID;
  lkg_students UUID[];
  chunk_ids UUID[];
  d DATE; i INT := 0;
BEGIN
  SELECT id INTO ukg_a FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000004' AND label='A';
  SELECT id INTO lkg_a FROM sections WHERE class_id='d0000000-0000-0000-0000-000000000003' AND label='A';
  SELECT id INTO test_teacher FROM users WHERE school_id='a0000000-0000-0000-0000-000000000001' AND mobile='8666666666';
  SELECT id INTO deepa FROM users WHERE school_id='a0000000-0000-0000-0000-000000000001' AND mobile='8444444444';
  SELECT id INTO advait_id FROM students WHERE name='Advait Sharma' AND school_id='a0000000-0000-0000-0000-000000000001';
  SELECT id INTO zara_id   FROM students WHERE name='Zara Ahmed'    AND school_id='a0000000-0000-0000-0000-000000000001';
  SELECT id INTO krish_id  FROM students WHERE name='Krish Menon'   AND school_id='a0000000-0000-0000-0000-000000000001';
  SELECT id INTO mia_id    FROM students WHERE name='Mia DSouza'    AND school_id='a0000000-0000-0000-0000-000000000001';
  SELECT id INTO yash_id   FROM students WHERE name='Yash Gupta'    AND school_id='a0000000-0000-0000-0000-000000000001';
  SELECT ARRAY(SELECT id FROM students WHERE section_id=lkg_a) INTO lkg_students;
  SELECT ARRAY(SELECT cc.id FROM curriculum_chunks cc JOIN curriculum_documents cd ON cd.id=cc.document_id JOIN classes c ON c.id=cd.class_id WHERE c.name='UKG' AND c.school_id='a0000000-0000-0000-0000-000000000001' ORDER BY cc.chunk_index LIMIT 20) INTO chunk_ids;
  IF ukg_a IS NULL OR test_teacher IS NULL OR advait_id IS NULL THEN RETURN; END IF;
  FOR d IN SELECT generate_series(CURRENT_DATE-9,CURRENT_DATE-1,'1 day'::interval)::date LOOP
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;
    i := i+1;
    INSERT INTO attendance_records (school_id,section_id,student_id,teacher_id,attend_date,status,submitted_at)
    SELECT 'a0000000-0000-0000-0000-000000000001',ukg_a,unnest(ARRAY[advait_id,krish_id,mia_id,yash_id]),test_teacher,d,'present',d+TIME '09:15' ON CONFLICT DO NOTHING;
    IF d = CURRENT_DATE-5 OR d = CURRENT_DATE-2 THEN
      INSERT INTO attendance_records (school_id,section_id,student_id,teacher_id,attend_date,status,submitted_at) VALUES ('a0000000-0000-0000-0000-000000000001',ukg_a,zara_id,test_teacher,d,'absent',d+TIME '09:15') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO attendance_records (school_id,section_id,student_id,teacher_id,attend_date,status,submitted_at) VALUES ('a0000000-0000-0000-0000-000000000001',ukg_a,zara_id,test_teacher,d,'present',d+TIME '09:15') ON CONFLICT DO NOTHING;
    END IF;
    IF chunk_ids IS NOT NULL AND array_length(chunk_ids,1) >= 2 THEN
      INSERT INTO daily_completions (school_id,section_id,teacher_id,completion_date,covered_chunk_ids,submitted_at)
      VALUES ('a0000000-0000-0000-0000-000000000001',ukg_a,test_teacher,d,ARRAY[chunk_ids[LEAST(i*2-1,array_length(chunk_ids,1))],chunk_ids[LEAST(i*2,array_length(chunk_ids,1))]],d+TIME '13:30')
      ON CONFLICT (section_id,completion_date) DO NOTHING;
    END IF;
    IF lkg_a IS NOT NULL AND deepa IS NOT NULL AND lkg_students IS NOT NULL AND array_length(lkg_students,1)>0 AND d BETWEEN CURRENT_DATE-7 AND CURRENT_DATE-4 THEN
      INSERT INTO attendance_records (school_id,section_id,student_id,teacher_id,attend_date,status,submitted_at)
      SELECT 'a0000000-0000-0000-0000-000000000001',lkg_a,unnest(lkg_students),deepa,d,'present',(d+1)+TIME '08:00' ON CONFLICT DO NOTHING;
      IF chunk_ids IS NOT NULL AND array_length(chunk_ids,1)>=1 THEN
        INSERT INTO daily_completions (school_id,section_id,teacher_id,completion_date,covered_chunk_ids,submitted_at)
        VALUES ('a0000000-0000-0000-0000-000000000001',lkg_a,deepa,d,ARRAY[chunk_ids[LEAST(i*2-1,array_length(chunk_ids,1))]],((d+1)+TIME '08:00'))
        ON CONFLICT (section_id,completion_date) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 16. ACTIVITY POOLS (no hardcoded IDs — let DB generate UUIDs)
INSERT INTO activity_pools (school_id,name,description,language) VALUES
  ('a0000000-0000-0000-0000-000000000001','English Rhymes','Classic English nursery rhymes','English'),
  ('a0000000-0000-0000-0000-000000000001','Kannada Rhymes','Kannada rhymes and songs','Kannada'),
  ('a0000000-0000-0000-0000-000000000001','Storytelling','Short moral stories','English'),
  ('a0000000-0000-0000-0000-000000000001','Public Speaking','Show and tell','English'),
  ('a0000000-0000-0000-0000-000000000001','Physical Activities','Outdoor games','None')
ON CONFLICT (school_id,name) DO NOTHING;

INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Twinkle Twinkle Little Star',0 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='English Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Baa Baa Black Sheep',1 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='English Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Humpty Dumpty',2 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='English Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Jack and Jill',3 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='English Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Incy Wincy Spider',4 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='English Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Aane Baa Aane',0 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Kannada Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Akka Pakka',1 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Kannada Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Namma Shale',2 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Kannada Rhymes' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','The Tortoise and the Hare',0 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Storytelling' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','The Lion and the Mouse',1 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Storytelling' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','The Ant and the Grasshopper',2 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Storytelling' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Goldilocks',3 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Storytelling' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','My Favourite Toy',0 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Public Speaking' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','My Family',1 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Public Speaking' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','My Favourite Food',2 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Public Speaking' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Duck Duck Goose',0 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Physical Activities' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Simon Says',1 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Physical Activities' ON CONFLICT (activity_pool_id,title) DO NOTHING;
INSERT INTO activities (activity_pool_id,school_id,title,position)
SELECT id,'a0000000-0000-0000-0000-000000000001','Freeze Dance',2 FROM activity_pools WHERE school_id='a0000000-0000-0000-0000-000000000001' AND name='Physical Activities' ON CONFLICT (activity_pool_id,title) DO NOTHING;

INSERT INTO pool_assignments (school_id,activity_pool_id,class_id,frequency_mode,interval_days,start_date,end_date)
SELECT 'a0000000-0000-0000-0000-000000000001',ap.id,'d0000000-0000-0000-0000-000000000004','weekly',NULL,'2026-06-01','2027-03-26' FROM activity_pools ap WHERE ap.school_id='a0000000-0000-0000-0000-000000000001' AND ap.name='English Rhymes' ON CONFLICT (activity_pool_id,class_id) DO NOTHING;
INSERT INTO pool_assignments (school_id,activity_pool_id,class_id,frequency_mode,interval_days,start_date,end_date)
SELECT 'a0000000-0000-0000-0000-000000000001',ap.id,'d0000000-0000-0000-0000-000000000004','weekly',NULL,'2026-06-01','2027-03-26' FROM activity_pools ap WHERE ap.school_id='a0000000-0000-0000-0000-000000000001' AND ap.name='Kannada Rhymes' ON CONFLICT (activity_pool_id,class_id) DO NOTHING;
INSERT INTO pool_assignments (school_id,activity_pool_id,class_id,frequency_mode,interval_days,start_date,end_date)
SELECT 'a0000000-0000-0000-0000-000000000001',ap.id,'d0000000-0000-0000-0000-000000000003','weekly',NULL,'2026-06-01','2027-03-26' FROM activity_pools ap WHERE ap.school_id='a0000000-0000-0000-0000-000000000001' AND ap.name='Storytelling' ON CONFLICT (activity_pool_id,class_id) DO NOTHING;
INSERT INTO pool_assignments (school_id,activity_pool_id,class_id,frequency_mode,interval_days,start_date,end_date)
SELECT 'a0000000-0000-0000-0000-000000000001',ap.id,'d0000000-0000-0000-0000-000000000003','interval',10,'2026-06-01','2027-03-26' FROM activity_pools ap WHERE ap.school_id='a0000000-0000-0000-0000-000000000001' AND ap.name='Public Speaking' ON CONFLICT (activity_pool_id,class_id) DO NOTHING;
INSERT INTO pool_assignments (school_id,activity_pool_id,class_id,frequency_mode,interval_days,start_date,end_date)
SELECT 'a0000000-0000-0000-0000-000000000001',ap.id,'d0000000-0000-0000-0000-000000000002','weekly',NULL,'2026-06-01','2027-03-26' FROM activity_pools ap WHERE ap.school_id='a0000000-0000-0000-0000-000000000001' AND ap.name='Physical Activities' ON CONFLICT (activity_pool_id,class_id) DO NOTHING;

-- 17. SECURITY QUESTIONS
INSERT INTO security_questions (text) VALUES ('What is the name of your first pet?'),('What city were you born in?'),('What is your mother''s maiden name?'),('What was the name of your first school?'),('What is your favourite childhood book?') ON CONFLICT (text) DO NOTHING;

COMMIT;
-- LOGINS (school: sojs, password = mobile number)
-- ── STAFF ──────────────────────────────────────────────────────────────────
-- admin          9999999999
-- principal      8888888888
-- teacher(UKG A) 8666666666
-- teacher(LKG A) 8444444444
-- supporting     8999999999
-- ── PARENTS (password = their mobile) ──────────────────────────────────────
-- Rajesh Sharma  9900000001  → child: Aarav Sharma (PG-A)
-- Amit Mehta     9900000002  → child: Ishaan Mehta (Nur-A)
-- Anil Verma     9900000003  → child: Riya Verma (LKG-A)
-- Rohit Sharma   9900000004  → child: Advait Sharma (UKG-A)
-- Farhan Ahmed   9900000005  → child: Zara Ahmed (UKG-A)
-- Suresh Patel   9900000006  → TWINS: Diya Patel (PG-A) + Arjun Kumar (Nur-A)
-- ── ACADEMIC YEAR ──────────────────────────────────────────────────────────
-- 2026-27 | June 1 2026 → March 26 2027
-- Settling: June 1-12 2026 (10 working days Mon-Fri)
-- Holidays: upload via Calendar → Import xlsx
