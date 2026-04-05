-- PARENT PASSWORD FIX
-- Hashes generated with bcryptjs (same library as the API) — guaranteed compatible
-- Password for each parent = their mobile number
-- Run this in Supabase SQL Editor

UPDATE parent_users SET password_hash = '$2a$12$MYwtFEXz6YgI.QqZofg6nu1pQYa6eI0XBUNlupFgVbcZgSGahuLIG', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000001'; -- Rajesh Sharma → password: 9900000001

UPDATE parent_users SET password_hash = '$2a$12$A3sFjgyb/0uXsWQEH6A1EeUzPQ4vtva/H0pTSEfZEwN2PxZII4ABW', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000002'; -- Amit Mehta → password: 9900000002

UPDATE parent_users SET password_hash = '$2a$12$ajR1hLnYqrlujgrYHU0.LOtiXQb/nqpBTtrFuyvHrDLwFKRa8eGH.', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000003'; -- Anil Verma → password: 9900000003

UPDATE parent_users SET password_hash = '$2a$12$hTkNpV6VENj52VsS.3xSHOQKIMfLCV2uQC6wZ4s90PHJCbLmQ726e', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000004'; -- Rohit Sharma → password: 9900000004

UPDATE parent_users SET password_hash = '$2a$12$wK8wsjsWpyraNuatHolgdOfB6KDpC/UgPLd1r04qRA6yyIETYxQbW', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000005'; -- Farhan Ahmed → password: 9900000005

UPDATE parent_users SET password_hash = '$2a$12$t9K6.1Jl7w24cgWqlMF46eZ4z4c9Q6XNciAtwDlfr.pcVBlzQ5fAC', is_active = true, force_password_reset = false
  WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile = '9900000006'; -- Suresh Patel → password: 9900000006

-- Verify all 6 are active
SELECT mobile, name, is_active, force_password_reset FROM parent_users
WHERE school_id = 'a0000000-0000-0000-0000-000000000001' AND mobile LIKE '990000000%'
ORDER BY mobile;

-- LOGIN: school=sojs, mobile=9900000001, password=9900000001 (etc.)
