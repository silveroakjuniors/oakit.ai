-- Seed: Silveroak Juniors initial data
-- Run AFTER all migrations (001-006)

-- 1. Insert school
INSERT INTO schools (id, name, subdomain, contact)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Silveroak Juniors',
  'sojs',
  '{"email": "admin@silveroakjuniors.edu", "phone": "+91-0000000000"}'
) ON CONFLICT (subdomain) DO NOTHING;

-- 2. Insert roles
INSERT INTO roles (id, school_id, name, permissions) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin',
   '["read:all","write:all","manage:users","manage:classes","manage:curriculum","manage:calendar"]'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'principal',
   '["read:all","read:dashboard","query:ai"]'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'teacher',
   '["read:own_plan","write:coverage_log","query:ai"]')
ON CONFLICT (school_id, name) DO NOTHING;

-- 3. Insert admin user
-- mobile: 9999999999, password: Admin@1234 (bcrypt hash below)
-- To generate a fresh hash: node -e "const b=require('bcryptjs');console.log(b.hashSync('Admin@1234',12))"
INSERT INTO users (id, school_id, role_id, name, mobile, email, password_hash, is_active, force_password_reset)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'School Admin',
  '9999999999',
  'admin@silveroakjuniors.edu',
  '$2a$12$azfc1XXNm9h3HntSe7e7yuZ41cXopN/zKvTSWoinsmIKspo6iHsIe',
  true,
  false
) ON CONFLICT (school_id, mobile) DO NOTHING;

-- 4. Insert classes
INSERT INTO classes (id, school_id, name) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'LKG'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'UKG'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Prep1'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Prep2')
ON CONFLICT (school_id, name) DO NOTHING;

-- 5. Insert default sections (A for each class)
INSERT INTO sections (school_id, class_id, label) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'A'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'A'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'A'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'A')
ON CONFLICT (class_id, label) DO NOTHING;
