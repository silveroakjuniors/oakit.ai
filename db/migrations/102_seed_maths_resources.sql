-- Seed: Maths curriculum resources for Jr. KG (SOJ)
-- Run after migration 102_curriculum_resources.sql

-- Get school and class IDs
DO $$
DECLARE
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'soj';
  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id AND LOWER(name) LIKE '%jr%kg%' LIMIT 1;

  IF v_school_id IS NULL OR v_class_id IS NULL THEN
    RAISE NOTICE 'School or class not found, skipping seed';
    RETURN;
  END IF;

  -- KL Lessons
  INSERT INTO curriculum_resources (school_id, class_id, subject, resource_id, resource_type, topic, book_page) VALUES
    (v_school_id, v_class_id, 'Maths', '1563', 'kl_lesson', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', '1348', 'kl_lesson', 'Comparison', '6, 7'),
    (v_school_id, v_class_id, 'Maths', '310', 'kl_lesson', 'Big and small', '8, 9'),
    (v_school_id, v_class_id, 'Maths', '315', 'kl_lesson', 'Long and short', '11'),
    (v_school_id, v_class_id, 'Maths', '296', 'kl_lesson', 'Numbers 1-10', '12-35'),
    (v_school_id, v_class_id, 'Maths', '1396', 'kl_lesson', 'Numbers 1-10', '12-35'),
    (v_school_id, v_class_id, 'Maths', '1255', 'kl_lesson', 'Numbers 1-10', '12-35'),
    (v_school_id, v_class_id, 'Maths', '305', 'kl_lesson', 'Numbers: Oral activities', '22, 36'),
    (v_school_id, v_class_id, 'Maths', '306', 'kl_lesson', 'Numbers: Oral activities', '22, 36'),
    (v_school_id, v_class_id, 'Maths', '330', 'kl_lesson', 'Shapes', '42-47'),
    (v_school_id, v_class_id, 'Maths', '364', 'kl_lesson', 'Number names: 1 to 10', '54, 55'),
    (v_school_id, v_class_id, 'Maths', '303', 'kl_lesson', 'Activities: 1 to 20', '57'),
    (v_school_id, v_class_id, 'Maths', '304', 'kl_lesson', 'Activities: 1 to 20', '57'),
    (v_school_id, v_class_id, 'Maths', '343', 'kl_lesson', 'Activities: 1 to 20', '57'),
    (v_school_id, v_class_id, 'Maths', '355', 'kl_lesson', 'Activities: 1 to 20', '57'),
    (v_school_id, v_class_id, 'Maths', '313', 'kl_lesson', 'Fat and thin', '58'),
    (v_school_id, v_class_id, 'Maths', '426', 'kl_lesson', 'Heavy and light', '59'),
    (v_school_id, v_class_id, 'Maths', '1356', 'kl_lesson', 'Open and close', '60'),
    (v_school_id, v_class_id, 'Maths', '1349', 'kl_lesson', 'Front and back', '61'),
    (v_school_id, v_class_id, 'Maths', '1571', 'kl_lesson', 'Up and down', '62'),
    (v_school_id, v_class_id, 'Maths', '1351', 'kl_lesson', 'Left and right', '63'),
    (v_school_id, v_class_id, 'Maths', '45', 'kl_lesson', 'Before, after and between numbers', '66'),
    (v_school_id, v_class_id, 'Maths', '362', 'kl_lesson', 'Before numbers: 1-10', '69'),
    (v_school_id, v_class_id, 'Maths', '449', 'kl_lesson', 'Between numbers: 1-20', '66, 68'),
    (v_school_id, v_class_id, 'Maths', '357', 'kl_lesson', 'Missing numbers: 21 to 50', '79'),
    (v_school_id, v_class_id, 'Maths', '1567', 'kl_lesson', 'Full and empty', '80'),
    (v_school_id, v_class_id, 'Maths', '1354', 'kl_lesson', 'One and many', '81'),
    (v_school_id, v_class_id, 'Maths', '1572', 'kl_lesson', 'Zero', '82, 83'),
    (v_school_id, v_class_id, 'Maths', '428', 'kl_lesson', 'More, less and one more', '85-87'),
    -- KL Activities
    (v_school_id, v_class_id, 'Maths', '337', 'kl_activity', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', '338', 'kl_activity', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', '339', 'kl_activity', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', '378', 'kl_activity', 'Big and small', '8, 9'),
    (v_school_id, v_class_id, 'Maths', '463', 'kl_activity', 'Big and small', '8, 9'),
    (v_school_id, v_class_id, 'Maths', '380', 'kl_activity', 'Long and short', '11'),
    (v_school_id, v_class_id, 'Maths', '465', 'kl_activity', 'Long and short', '11'),
    (v_school_id, v_class_id, 'Maths', '297', 'kl_activity', 'Numbers 1-10', '12-35'),
    (v_school_id, v_class_id, 'Maths', '299', 'kl_activity', 'Numbers 1-10', '12-35'),
    (v_school_id, v_class_id, 'Maths', '331', 'kl_activity', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', '332', 'kl_activity', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', '333', 'kl_activity', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', '389', 'kl_activity', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', '46', 'kl_activity', 'Shapes', '42-47'),
    (v_school_id, v_class_id, 'Maths', '467', 'kl_activity', 'Shapes', '42-47'),
    (v_school_id, v_class_id, 'Maths', '365', 'kl_activity', 'Number names: 1 to 10', '54, 55'),
    (v_school_id, v_class_id, 'Maths', '366', 'kl_activity', 'Number names: 1 to 10', '54, 55'),
    (v_school_id, v_class_id, 'Maths', '379', 'kl_activity', 'Fat and thin', '58'),
    (v_school_id, v_class_id, 'Maths', '382', 'kl_activity', 'Heavy and light', '59'),
    (v_school_id, v_class_id, 'Maths', '346', 'kl_activity', 'Up and down', '62'),
    (v_school_id, v_class_id, 'Maths', '347', 'kl_activity', 'Up and down', '62'),
    (v_school_id, v_class_id, 'Maths', '363', 'kl_activity', 'Before, after and between numbers', '66'),
    (v_school_id, v_class_id, 'Maths', '456', 'kl_activity', 'After numbers: 1-20', '67'),
    (v_school_id, v_class_id, 'Maths', '1419', 'kl_activity', 'After numbers: 1-20', '67'),
    (v_school_id, v_class_id, 'Maths', '451', 'kl_activity', 'Between numbers: 1-20', '68'),
    (v_school_id, v_class_id, 'Maths', '1421', 'kl_activity', 'Between numbers: 1-20', '68'),
    (v_school_id, v_class_id, 'Maths', '454', 'kl_activity', 'Before numbers: 1-10', '69'),
    (v_school_id, v_class_id, 'Maths', '1420', 'kl_activity', 'Before numbers: 1-10', '69'),
    (v_school_id, v_class_id, 'Maths', '398', 'kl_activity', 'Arranging numbers: 1 to 10', '38'),
    (v_school_id, v_class_id, 'Maths', '351', 'kl_activity', 'Match the objects: 1 to 10', '74'),
    (v_school_id, v_class_id, 'Maths', '353', 'kl_activity', 'Match the objects: 1 to 10', '74'),
    (v_school_id, v_class_id, 'Maths', '358', 'kl_activity', 'Missing numbers: 21 to 50', '79'),
    (v_school_id, v_class_id, 'Maths', '430', 'kl_activity', 'One and many', '81'),
    (v_school_id, v_class_id, 'Maths', '383', 'kl_activity', 'More, less and one more', '85-87'),
    (v_school_id, v_class_id, 'Maths', '429', 'kl_activity', 'More, less and one more', '85-87'),
    -- Interactive Worksheets
    (v_school_id, v_class_id, 'Maths', 'w9301', 'interactive_worksheet', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', 'w9302', 'interactive_worksheet', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', 'w9303', 'interactive_worksheet', 'Same and different, grouping', '3-5'),
    (v_school_id, v_class_id, 'Maths', 'w9304', 'interactive_worksheet', 'Comparison', '6, 7'),
    (v_school_id, v_class_id, 'Maths', 'w9305', 'interactive_worksheet', 'Big and small', '8, 9'),
    (v_school_id, v_class_id, 'Maths', 'w9306', 'interactive_worksheet', 'Big and small', '8, 9'),
    (v_school_id, v_class_id, 'Maths', 'w9307', 'interactive_worksheet', 'Tall and short', '10'),
    (v_school_id, v_class_id, 'Maths', 'w9308', 'interactive_worksheet', 'Long and short', '11'),
    (v_school_id, v_class_id, 'Maths', 'w9309', 'interactive_worksheet', 'Number 1', '12, 13'),
    (v_school_id, v_class_id, 'Maths', 'w9310', 'interactive_worksheet', 'Number 2', '14, 15'),
    (v_school_id, v_class_id, 'Maths', 'w9311', 'interactive_worksheet', 'Number 3', '16, 17'),
    (v_school_id, v_class_id, 'Maths', 'w9312', 'interactive_worksheet', 'Number 4', '18, 19'),
    (v_school_id, v_class_id, 'Maths', 'w9313', 'interactive_worksheet', 'Number 5', '20, 21'),
    (v_school_id, v_class_id, 'Maths', 'w9314', 'interactive_worksheet', 'Numbers 1-5: Oral activities', '22'),
    (v_school_id, v_class_id, 'Maths', 'w9315', 'interactive_worksheet', 'Count and choose: 1 to 5', '23'),
    (v_school_id, v_class_id, 'Maths', 'w9316', 'interactive_worksheet', 'Count and choose: 1 to 5', '24'),
    (v_school_id, v_class_id, 'Maths', 'w9317', 'interactive_worksheet', 'Count and choose: 1 to 5', '25'),
    (v_school_id, v_class_id, 'Maths', 'w9318', 'interactive_worksheet', 'Number 6', '26, 27'),
    (v_school_id, v_class_id, 'Maths', 'w9319', 'interactive_worksheet', 'Number 7', '28, 29'),
    (v_school_id, v_class_id, 'Maths', 'w9320', 'interactive_worksheet', 'Number 8', '30, 31'),
    (v_school_id, v_class_id, 'Maths', 'w9321', 'interactive_worksheet', 'Number 9', '32, 33'),
    (v_school_id, v_class_id, 'Maths', 'w9322', 'interactive_worksheet', 'Number 10', '34, 35'),
    (v_school_id, v_class_id, 'Maths', 'w9323', 'interactive_worksheet', 'Numbers 6-10: Oral activities', '36'),
    (v_school_id, v_class_id, 'Maths', 'w9324', 'interactive_worksheet', 'Writing practice: 1 to 10', '37'),
    (v_school_id, v_class_id, 'Maths', 'w9325', 'interactive_worksheet', 'Arranging numbers: 1 to 10', '38'),
    (v_school_id, v_class_id, 'Maths', 'w9326', 'interactive_worksheet', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', 'w9327', 'interactive_worksheet', 'Count and write: 1 to 10', '39-41'),
    (v_school_id, v_class_id, 'Maths', 'w9328', 'interactive_worksheet', 'Shapes - Circle', '42'),
    (v_school_id, v_class_id, 'Maths', 'w9329', 'interactive_worksheet', 'Shapes - Triangle', '43'),
    (v_school_id, v_class_id, 'Maths', 'w9330', 'interactive_worksheet', 'Shapes - Square', '44'),
    (v_school_id, v_class_id, 'Maths', 'w9331', 'interactive_worksheet', 'Shapes - Rectangle', '45'),
    (v_school_id, v_class_id, 'Maths', 'w9332', 'interactive_worksheet', 'Shapes - Activities', '46, 47'),
    (v_school_id, v_class_id, 'Maths', 'w9333', 'interactive_worksheet', 'Shapes - Activities', '46, 47'),
    (v_school_id, v_class_id, 'Maths', 'w9334', 'interactive_worksheet', 'Numbers 11 and 12', '48'),
    (v_school_id, v_class_id, 'Maths', 'w9335', 'interactive_worksheet', 'Numbers 13 and 14', '49'),
    (v_school_id, v_class_id, 'Maths', 'w9336', 'interactive_worksheet', 'Number 15 Writing practice', '50'),
    (v_school_id, v_class_id, 'Maths', 'w9337', 'interactive_worksheet', 'Numbers 16 and 17', '51'),
    (v_school_id, v_class_id, 'Maths', 'w9338', 'interactive_worksheet', 'Numbers 18 and 19', '52'),
    (v_school_id, v_class_id, 'Maths', 'w9339', 'interactive_worksheet', 'Number 20 Writing practice', '53'),
    (v_school_id, v_class_id, 'Maths', 'w9340', 'interactive_worksheet', 'Number names: 1 to 10', '54, 55'),
    (v_school_id, v_class_id, 'Maths', 'w9341', 'interactive_worksheet', 'Number names: 1 to 10', '54, 55'),
    (v_school_id, v_class_id, 'Maths', 'w9342', 'interactive_worksheet', 'Writing practice: 11 to 20', '56'),
    (v_school_id, v_class_id, 'Maths', 'w9343', 'interactive_worksheet', 'Activities: 1 to 20', '57'),
    (v_school_id, v_class_id, 'Maths', 'w9344', 'interactive_worksheet', 'Fat and thin', '58'),
    (v_school_id, v_class_id, 'Maths', 'w9345', 'interactive_worksheet', 'Heavy and light', '59'),
    (v_school_id, v_class_id, 'Maths', 'w9346', 'interactive_worksheet', 'Open and close', '60'),
    (v_school_id, v_class_id, 'Maths', 'w9347', 'interactive_worksheet', 'Front and back', '61'),
    (v_school_id, v_class_id, 'Maths', 'w9348', 'interactive_worksheet', 'Up and down', '62'),
    (v_school_id, v_class_id, 'Maths', 'w9349', 'interactive_worksheet', 'Left and right', '63'),
    (v_school_id, v_class_id, 'Maths', 'w9350', 'interactive_worksheet', 'Logical skills - patterns', '64, 65'),
    (v_school_id, v_class_id, 'Maths', 'w9351', 'interactive_worksheet', 'Logical skills - patterns', '64, 65'),
    (v_school_id, v_class_id, 'Maths', 'w9352', 'interactive_worksheet', 'Before, after and between numbers', '66'),
    (v_school_id, v_class_id, 'Maths', 'w9353', 'interactive_worksheet', 'After numbers: 1-20', '67'),
    (v_school_id, v_class_id, 'Maths', 'w9354', 'interactive_worksheet', 'Between numbers: 1-20', '68'),
    (v_school_id, v_class_id, 'Maths', 'w9355', 'interactive_worksheet', 'Before numbers: 1-10', '69'),
    (v_school_id, v_class_id, 'Maths', 'w9356', 'interactive_worksheet', 'Math talk', '70, 71'),
    (v_school_id, v_class_id, 'Maths', 'w9357', 'interactive_worksheet', 'Math talk', '70, 71'),
    (v_school_id, v_class_id, 'Maths', 'w9358', 'interactive_worksheet', 'Count and write', '72, 73'),
    (v_school_id, v_class_id, 'Maths', 'w9359', 'interactive_worksheet', 'Count and write', '72, 73'),
    (v_school_id, v_class_id, 'Maths', 'w9360', 'interactive_worksheet', 'Match the objects: 1 to 10', '74'),
    (v_school_id, v_class_id, 'Maths', 'w9361', 'interactive_worksheet', 'Writing practice: 21 to 30', '75'),
    (v_school_id, v_class_id, 'Maths', 'w9362', 'interactive_worksheet', 'Revision', '76'),
    (v_school_id, v_class_id, 'Maths', 'w9363', 'interactive_worksheet', 'Writing practice: 31-40', '77'),
    (v_school_id, v_class_id, 'Maths', 'w9364', 'interactive_worksheet', 'Writing practice: 41-50', '78'),
    (v_school_id, v_class_id, 'Maths', 'w9365', 'interactive_worksheet', 'Missing numbers: 21 to 50', '79'),
    (v_school_id, v_class_id, 'Maths', 'w9366', 'interactive_worksheet', 'Full and empty', '80'),
    (v_school_id, v_class_id, 'Maths', 'w9367', 'interactive_worksheet', 'One and many', '81'),
    (v_school_id, v_class_id, 'Maths', 'w9368', 'interactive_worksheet', 'Zero', '82, 83'),
    (v_school_id, v_class_id, 'Maths', 'w9369', 'interactive_worksheet', 'Zero', '82, 83'),
    (v_school_id, v_class_id, 'Maths', 'w9370', 'interactive_worksheet', 'Equal sets', '84'),
    (v_school_id, v_class_id, 'Maths', 'w9371', 'interactive_worksheet', 'More, less and one more', '85-87'),
    (v_school_id, v_class_id, 'Maths', 'w9372', 'interactive_worksheet', 'More, less and one more', '85-87'),
    (v_school_id, v_class_id, 'Maths', 'w9373', 'interactive_worksheet', 'More, less and one more', '85-87'),
    (v_school_id, v_class_id, 'Maths', 'w9374', 'interactive_worksheet', 'Counting activity', '88')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted % Maths resources for Jr. KG', (SELECT COUNT(*) FROM curriculum_resources WHERE school_id = v_school_id AND class_id = v_class_id AND subject = 'Maths');
END $$;


-- Seed: GK (General Knowledge) curriculum resources for Jr. KG (SOJ)
DO $$
DECLARE
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'soj';
  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id AND LOWER(name) LIKE '%jr%kg%' LIMIT 1;

  IF v_school_id IS NULL OR v_class_id IS NULL THEN
    RAISE NOTICE 'School or class not found, skipping GK seed';
    RETURN;
  END IF;

  INSERT INTO curriculum_resources (school_id, class_id, subject, resource_id, resource_type, topic, book_page) VALUES
    -- KL Lessons
    (v_school_id, v_class_id, 'GK', '218', 'kl_lesson', 'Greeting/courtesy words', '3'),
    (v_school_id, v_class_id, 'GK', '1353', 'kl_lesson', 'Myself', '5'),
    (v_school_id, v_class_id, 'GK', '213', 'kl_lesson', 'My body', '6'),
    (v_school_id, v_class_id, 'GK', '175', 'kl_lesson', 'My family', '7, 9, 10'),
    (v_school_id, v_class_id, 'GK', '1561', 'kl_lesson', 'My family', '7, 9, 10'),
    (v_school_id, v_class_id, 'GK', '278', 'kl_lesson', 'My home', '8'),
    (v_school_id, v_class_id, 'GK', '240', 'kl_lesson', 'Fruits', '13, 14, 15'),
    (v_school_id, v_class_id, 'GK', '183', 'kl_lesson', 'Vegetables', '17-19'),
    (v_school_id, v_class_id, 'GK', '198', 'kl_lesson', 'Flowers', '22, 23'),
    (v_school_id, v_class_id, 'GK', '188', 'kl_lesson', 'Birds', '26, 27'),
    (v_school_id, v_class_id, 'GK', '255', 'kl_lesson', 'Pets', '28, 29'),
    (v_school_id, v_class_id, 'GK', '214', 'kl_lesson', 'Farm animals', '30, 31'),
    (v_school_id, v_class_id, 'GK', '205', 'kl_lesson', 'Wild animals', '32, 33'),
    (v_school_id, v_class_id, 'GK', '1562', 'kl_lesson', 'Young ones - Wild animals', '36, 37'),
    (v_school_id, v_class_id, 'GK', '196', 'kl_lesson', 'Animal homes', '38, 39'),
    (v_school_id, v_class_id, 'GK', '1553', 'kl_lesson', 'Health and hygiene', '40-46'),
    (v_school_id, v_class_id, 'GK', '1554', 'kl_lesson', 'Health and hygiene', '40-46'),
    (v_school_id, v_class_id, 'GK', '1555', 'kl_lesson', 'Health and hygiene', '40-46'),
    (v_school_id, v_class_id, 'GK', '185', 'kl_lesson', 'Day and night', '48, 49'),
    (v_school_id, v_class_id, 'GK', '238', 'kl_lesson', 'Vehicles', '50-53'),
    (v_school_id, v_class_id, 'GK', '230', 'kl_lesson', 'People who help us', '54, 55'),
    -- KL Activities
    (v_school_id, v_class_id, 'GK', '219', 'kl_activity', 'Greeting/courtesy words', '3'),
    (v_school_id, v_class_id, 'GK', '178', 'kl_activity', 'Sounds we hear around us', '4'),
    (v_school_id, v_class_id, 'GK', '245', 'kl_activity', 'Sounds we hear around us', '4'),
    (v_school_id, v_class_id, 'GK', '62', 'kl_activity', 'Myself', '5'),
    (v_school_id, v_class_id, 'GK', '1359', 'kl_activity', 'My body', '6'),
    (v_school_id, v_class_id, 'GK', '176', 'kl_activity', 'My family', '7, 9, 10'),
    (v_school_id, v_class_id, 'GK', '279', 'kl_activity', 'My home', '8'),
    (v_school_id, v_class_id, 'GK', '1352', 'kl_activity', 'My feelings', '11'),
    (v_school_id, v_class_id, 'GK', '241', 'kl_activity', 'Fruits', '13, 14, 15'),
    (v_school_id, v_class_id, 'GK', '248', 'kl_activity', 'Vegetables', '17-19'),
    (v_school_id, v_class_id, 'GK', '1385', 'kl_activity', 'Beginning letter - Fruits and vegetables', '20'),
    (v_school_id, v_class_id, 'GK', '199', 'kl_activity', 'Flowers', '22, 23'),
    (v_school_id, v_class_id, 'GK', '200', 'kl_activity', 'Flowers', '22, 23'),
    (v_school_id, v_class_id, 'GK', '189', 'kl_activity', 'Birds', '26, 27'),
    (v_school_id, v_class_id, 'GK', '239', 'kl_activity', 'Birds', '26, 27'),
    (v_school_id, v_class_id, 'GK', '256', 'kl_activity', 'Pets', '28, 29'),
    (v_school_id, v_class_id, 'GK', '215', 'kl_activity', 'Farm animals / Young ones', '30, 31, 34, 35'),
    (v_school_id, v_class_id, 'GK', '206', 'kl_activity', 'Wild animals', '32, 33'),
    (v_school_id, v_class_id, 'GK', '244', 'kl_activity', 'Wild animals', '32, 33'),
    (v_school_id, v_class_id, 'GK', '197', 'kl_activity', 'Animal homes', '38, 39'),
    (v_school_id, v_class_id, 'GK', '242', 'kl_activity', 'Animal homes', '38, 39'),
    (v_school_id, v_class_id, 'GK', '1556', 'kl_activity', 'Health and hygiene', '40-46'),
    (v_school_id, v_class_id, 'GK', '186', 'kl_activity', 'Day and night', '48, 49'),
    (v_school_id, v_class_id, 'GK', '187', 'kl_activity', 'Day and night', '48, 49'),
    (v_school_id, v_class_id, 'GK', '1368', 'kl_activity', 'Vehicles', '50-53'),
    (v_school_id, v_class_id, 'GK', '1360', 'kl_activity', 'People who help us', '54, 55'),
    -- Interactive Worksheets
    (v_school_id, v_class_id, 'GK', 'w9401', 'interactive_worksheet', 'Greeting/courtesy words', '3'),
    (v_school_id, v_class_id, 'GK', 'w9402', 'interactive_worksheet', 'Sounds we hear around us', '4'),
    (v_school_id, v_class_id, 'GK', 'w9403', 'interactive_worksheet', 'Myself', '5'),
    (v_school_id, v_class_id, 'GK', 'w9404', 'interactive_worksheet', 'My body', '6'),
    (v_school_id, v_class_id, 'GK', 'w9405', 'interactive_worksheet', 'My family', '7'),
    (v_school_id, v_class_id, 'GK', 'w9406', 'interactive_worksheet', 'My home', '8'),
    (v_school_id, v_class_id, 'GK', 'w9407', 'interactive_worksheet', 'My family', '9'),
    (v_school_id, v_class_id, 'GK', 'w9408', 'interactive_worksheet', 'My family', '10'),
    (v_school_id, v_class_id, 'GK', 'w9409', 'interactive_worksheet', 'My feelings', '11'),
    (v_school_id, v_class_id, 'GK', 'w9410', 'interactive_worksheet', 'Red theme - Apple, Tomato', '12'),
    (v_school_id, v_class_id, 'GK', 'w9411', 'interactive_worksheet', 'Fruits', '13'),
    (v_school_id, v_class_id, 'GK', 'w9412', 'interactive_worksheet', 'Fruits', '14'),
    (v_school_id, v_class_id, 'GK', 'w9413', 'interactive_worksheet', 'Fruits', '15'),
    (v_school_id, v_class_id, 'GK', 'w9414', 'interactive_worksheet', 'Yellow theme - Banana, Corn', '16'),
    (v_school_id, v_class_id, 'GK', 'w9415', 'interactive_worksheet', 'Vegetables', '17'),
    (v_school_id, v_class_id, 'GK', 'w9416', 'interactive_worksheet', 'Vegetables', '18'),
    (v_school_id, v_class_id, 'GK', 'w9417', 'interactive_worksheet', 'Vegetables', '19'),
    (v_school_id, v_class_id, 'GK', 'w9418', 'interactive_worksheet', 'Beginning letter - Fruits and vegetables', '20'),
    (v_school_id, v_class_id, 'GK', 'w9419', 'interactive_worksheet', 'Green theme - Jackfruit, Chilli', '21'),
    (v_school_id, v_class_id, 'GK', 'w9420', 'interactive_worksheet', 'Flowers', '22'),
    (v_school_id, v_class_id, 'GK', 'w9421', 'interactive_worksheet', 'Flowers', '23'),
    (v_school_id, v_class_id, 'GK', 'w9422', 'interactive_worksheet', 'Colour themes - Blue, Orange, Purple', '24'),
    (v_school_id, v_class_id, 'GK', 'w9423', 'interactive_worksheet', 'Colour themes - Blue, Orange, Purple', '25'),
    (v_school_id, v_class_id, 'GK', 'w9424', 'interactive_worksheet', 'Birds', '26'),
    (v_school_id, v_class_id, 'GK', 'w9425', 'interactive_worksheet', 'Birds', '27'),
    (v_school_id, v_class_id, 'GK', 'w9426', 'interactive_worksheet', 'Pets', '28'),
    (v_school_id, v_class_id, 'GK', 'w9427', 'interactive_worksheet', 'Pets', '29'),
    (v_school_id, v_class_id, 'GK', 'w9428', 'interactive_worksheet', 'Farm animals', '30'),
    (v_school_id, v_class_id, 'GK', 'w9429', 'interactive_worksheet', 'Farm animals', '31'),
    (v_school_id, v_class_id, 'GK', 'w9430', 'interactive_worksheet', 'Wild animals', '32'),
    (v_school_id, v_class_id, 'GK', 'w9431', 'interactive_worksheet', 'Wild animals', '33'),
    (v_school_id, v_class_id, 'GK', 'w9432', 'interactive_worksheet', 'Young ones - Farm animals', '34'),
    (v_school_id, v_class_id, 'GK', 'w9433', 'interactive_worksheet', 'Young ones - Farm animals', '35'),
    (v_school_id, v_class_id, 'GK', 'w9434', 'interactive_worksheet', 'Young ones - Wild animals', '36'),
    (v_school_id, v_class_id, 'GK', 'w9435', 'interactive_worksheet', 'Young ones - Wild animals', '37'),
    (v_school_id, v_class_id, 'GK', 'w9436', 'interactive_worksheet', 'Animal homes', '38'),
    (v_school_id, v_class_id, 'GK', 'w9437', 'interactive_worksheet', 'Animal homes', '39'),
    (v_school_id, v_class_id, 'GK', 'w9438', 'interactive_worksheet', 'Health and hygiene', '40'),
    (v_school_id, v_class_id, 'GK', 'w9439', 'interactive_worksheet', 'Health and hygiene', '41'),
    (v_school_id, v_class_id, 'GK', 'w9440', 'interactive_worksheet', 'Health and hygiene', '42'),
    (v_school_id, v_class_id, 'GK', 'w9441', 'interactive_worksheet', 'Health and hygiene', '43'),
    (v_school_id, v_class_id, 'GK', 'w9442', 'interactive_worksheet', 'Health and hygiene', '44'),
    (v_school_id, v_class_id, 'GK', 'w9443', 'interactive_worksheet', 'Health and hygiene', '45'),
    (v_school_id, v_class_id, 'GK', 'w9444', 'interactive_worksheet', 'Health and hygiene', '46'),
    (v_school_id, v_class_id, 'GK', 'w9445', 'interactive_worksheet', 'Taste of food', '47'),
    (v_school_id, v_class_id, 'GK', 'w9446', 'interactive_worksheet', 'Day and night', '48'),
    (v_school_id, v_class_id, 'GK', 'w9447', 'interactive_worksheet', 'Day and night', '49'),
    (v_school_id, v_class_id, 'GK', 'w9448', 'interactive_worksheet', 'Vehicles', '50'),
    (v_school_id, v_class_id, 'GK', 'w9449', 'interactive_worksheet', 'Vehicles', '51'),
    (v_school_id, v_class_id, 'GK', 'w9450', 'interactive_worksheet', 'Vehicles', '52, 53'),
    (v_school_id, v_class_id, 'GK', 'w9451', 'interactive_worksheet', 'People who help us', '54'),
    (v_school_id, v_class_id, 'GK', 'w9452', 'interactive_worksheet', 'People who help us', '55'),
    (v_school_id, v_class_id, 'GK', 'w9453', 'interactive_worksheet', 'Cross-curricular activity', '56')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted GK resources for Jr. KG: %', (SELECT COUNT(*) FROM curriculum_resources WHERE school_id = v_school_id AND class_id = v_class_id AND subject = 'GK');
END $$;


-- Seed: Rhymes curriculum resources for Jr. KG (SOJ)
DO $$
DECLARE
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'soj';
  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id AND LOWER(name) LIKE '%jr%kg%' LIMIT 1;

  IF v_school_id IS NULL OR v_class_id IS NULL THEN
    RAISE NOTICE 'School or class not found, skipping Rhymes seed';
    RETURN;
  END IF;

  INSERT INTO curriculum_resources (school_id, class_id, subject, resource_id, resource_type, topic, book_page) VALUES
    (v_school_id, v_class_id, 'Rhymes', '1512', 'kl_lesson', 'LKG Rhymes - Menu', '1'),
    (v_school_id, v_class_id, 'Rhymes', '1493', 'kl_lesson', 'Head, shoulders, knees and toes', '2'),
    (v_school_id, v_class_id, 'Rhymes', '1258', 'kl_lesson', 'Chubby cheeks', '3'),
    (v_school_id, v_class_id, 'Rhymes', '1168', 'kl_lesson', 'Are you sleeping?', '4'),
    (v_school_id, v_class_id, 'Rhymes', '1478', 'kl_lesson', 'Two little feet', '5'),
    (v_school_id, v_class_id, 'Rhymes', '1472', 'kl_lesson', 'Roly poly', '6'),
    (v_school_id, v_class_id, 'Rhymes', '1479', 'kl_lesson', 'Clean hands', '7'),
    (v_school_id, v_class_id, 'Rhymes', '1457', 'kl_lesson', 'Ten little fingers', '8'),
    (v_school_id, v_class_id, 'Rhymes', '1452', 'kl_lesson', 'One, two, three, four, five', '9'),
    (v_school_id, v_class_id, 'Rhymes', '1256', 'kl_lesson', 'A B C D rhyme', '10'),
    (v_school_id, v_class_id, 'Rhymes', '620', 'kl_lesson', 'Baa baa black sheep', '11'),
    (v_school_id, v_class_id, 'Rhymes', '603', 'kl_lesson', 'Baa baa black sheep', '11'),
    (v_school_id, v_class_id, 'Rhymes', '1494', 'kl_lesson', 'Boogie woogie', '12'),
    (v_school_id, v_class_id, 'Rhymes', '1260', 'kl_lesson', 'Hickory dickory', '13'),
    (v_school_id, v_class_id, 'Rhymes', '1476', 'kl_lesson', 'Twinkle twinkle', '14'),
    (v_school_id, v_class_id, 'Rhymes', '1456', 'kl_lesson', 'Take a bus', '15'),
    (v_school_id, v_class_id, 'Rhymes', '1268', 'kl_lesson', 'One, two', '16'),
    (v_school_id, v_class_id, 'Rhymes', '1495', 'kl_lesson', 'Wheels on the bus', '17'),
    (v_school_id, v_class_id, 'Rhymes', '1436', 'kl_lesson', 'Count with animals', '18'),
    (v_school_id, v_class_id, 'Rhymes', '1491', 'kl_lesson', 'Shapes', '19'),
    (v_school_id, v_class_id, 'Rhymes', '1257', 'kl_lesson', 'Bits of paper', '20'),
    (v_school_id, v_class_id, 'Rhymes', '1434', 'kl_lesson', 'Clap your hands', '21'),
    (v_school_id, v_class_id, 'Rhymes', '648', 'kl_lesson', 'Incy wincy spider', '22'),
    (v_school_id, v_class_id, 'Rhymes', '628', 'kl_lesson', 'Incy wincy spider', '22'),
    (v_school_id, v_class_id, 'Rhymes', '1445', 'kl_lesson', 'Hop a little', '23'),
    (v_school_id, v_class_id, 'Rhymes', '1432', 'kl_lesson', 'Counting Apples', '24'),
    (v_school_id, v_class_id, 'Rhymes', '1496', 'kl_lesson', 'I''m a little teapot', '25'),
    (v_school_id, v_class_id, 'Rhymes', '1498', 'kl_lesson', 'The chook chook train', '26'),
    (v_school_id, v_class_id, 'Rhymes', '1271', 'kl_lesson', 'Row, row', '27'),
    (v_school_id, v_class_id, 'Rhymes', '1471', 'kl_lesson', 'Pat-a-cake', '28'),
    (v_school_id, v_class_id, 'Rhymes', '1497', 'kl_lesson', 'Mary had a little lamb', '29'),
    (v_school_id, v_class_id, 'Rhymes', '1486', 'kl_lesson', 'I see the moon', '30'),
    (v_school_id, v_class_id, 'Rhymes', '1273', 'kl_lesson', 'Jingle bells', '31'),
    (v_school_id, v_class_id, 'Rhymes', '607', 'kl_lesson', 'Happy birthday song', '32'),
    (v_school_id, v_class_id, 'Rhymes', '1439', 'kl_lesson', 'Farewell song', '33'),
    (v_school_id, v_class_id, 'Rhymes', '1481', 'kl_lesson', 'We welcome you', '34'),
    (v_school_id, v_class_id, 'Rhymes', '1435', 'kl_lesson', 'Colours and actions', '35'),
    (v_school_id, v_class_id, 'Rhymes', '630', 'kl_lesson', 'Ring-a-Ring', '36'),
    (v_school_id, v_class_id, 'Rhymes', '616', 'kl_lesson', 'Ring-a-Ring', '36'),
    (v_school_id, v_class_id, 'Rhymes', '631', 'kl_lesson', 'Rock a Bye Baby', '37'),
    (v_school_id, v_class_id, 'Rhymes', '627', 'kl_lesson', 'I hear thunder', '38'),
    (v_school_id, v_class_id, 'Rhymes', '1447', 'kl_lesson', 'I like to paint', '39'),
    (v_school_id, v_class_id, 'Rhymes', '629', 'kl_lesson', 'Little Miss Muffet', '40'),
    (v_school_id, v_class_id, 'Rhymes', '619', 'kl_lesson', 'Love the alphabets', '41'),
    (v_school_id, v_class_id, 'Rhymes', '1465', 'kl_lesson', 'We say thank you', '42'),
    (v_school_id, v_class_id, 'Rhymes', '1442', 'kl_lesson', 'Five little monkeys', '43'),
    (v_school_id, v_class_id, 'Rhymes', '615', 'kl_lesson', 'Rain rain', '44'),
    (v_school_id, v_class_id, 'Rhymes', '1488', 'kl_lesson', 'Fruits rhyme 2', '45'),
    (v_school_id, v_class_id, 'Rhymes', '1461', 'kl_lesson', 'Up in the dark sky', '46'),
    (v_school_id, v_class_id, 'Rhymes', '1462', 'kl_lesson', 'Up up up', '47'),
    (v_school_id, v_class_id, 'Rhymes', '1505', 'kl_lesson', 'Bend bend', '48'),
    (v_school_id, v_class_id, 'Rhymes', '1489', 'kl_lesson', 'Bingo', '49'),
    (v_school_id, v_class_id, 'Rhymes', '1506', 'kl_lesson', 'Brush your teeth', '50'),
    (v_school_id, v_class_id, 'Rhymes', '1485', 'kl_lesson', 'I am a big engine', '51'),
    (v_school_id, v_class_id, 'Rhymes', '1468', 'kl_lesson', 'I am special', '52'),
    (v_school_id, v_class_id, 'Rhymes', '1448', 'kl_lesson', 'Jelly on a plate', '53'),
    (v_school_id, v_class_id, 'Rhymes', '614', 'kl_lesson', 'Johnny Johnny', '54'),
    (v_school_id, v_class_id, 'Rhymes', '54', 'kl_lesson', 'Ten little Indians', '55'),
    (v_school_id, v_class_id, 'Rhymes', '1476', 'kl_lesson', 'Twinkle twinkle traffic', '56'),
    (v_school_id, v_class_id, 'Rhymes', '1440', 'kl_lesson', 'The farmer in the dell', '57'),
    (v_school_id, v_class_id, 'Rhymes', '1460', 'kl_lesson', 'This is the way we pump a tyre', '58'),
    (v_school_id, v_class_id, 'Rhymes', '606', 'kl_lesson', 'Ding dong bell', '59'),
    (v_school_id, v_class_id, 'Rhymes', '1464', 'kl_lesson', 'Violin violin', '60'),
    (v_school_id, v_class_id, 'Rhymes', '1508', 'kl_lesson', 'Cobbler cobbler', '61'),
    (v_school_id, v_class_id, 'Rhymes', '1469', 'kl_lesson', 'I use my eyes to see', '62'),
    (v_school_id, v_class_id, 'Rhymes', '622', 'kl_lesson', 'If you''re happy', '63'),
    (v_school_id, v_class_id, 'Rhymes', '611', 'kl_lesson', 'If you''re happy', '63'),
    (v_school_id, v_class_id, 'Rhymes', '1507', 'kl_lesson', 'Bubbles bubbles', '64'),
    (v_school_id, v_class_id, 'Rhymes', '621', 'kl_lesson', 'Humpty Dumpty', '65'),
    (v_school_id, v_class_id, 'Rhymes', '618', 'kl_lesson', 'Humpty Dumpty', '65'),
    (v_school_id, v_class_id, 'Rhymes', '1466', 'kl_lesson', '1 yellow 2 yellow', '66')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted Rhymes resources for Jr. KG: %', (SELECT COUNT(*) FROM curriculum_resources WHERE school_id = v_school_id AND class_id = v_class_id AND subject = 'Rhymes');
END $$;


-- Seed: English curriculum resources for Jr. KG (SOJ)
DO $$
DECLARE
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'soj';
  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id AND LOWER(name) LIKE '%jr%kg%' LIMIT 1;

  IF v_school_id IS NULL OR v_class_id IS NULL THEN
    RAISE NOTICE 'School or class not found, skipping English seed';
    RETURN;
  END IF;

  INSERT INTO curriculum_resources (school_id, class_id, subject, resource_id, resource_type, topic, book_page) VALUES
    -- KL Lessons (main resources)
    (v_school_id, v_class_id, 'English', '1256', 'kl_lesson', 'Alphabet song', '3'),
    (v_school_id, v_class_id, 'English', '1514', 'kl_lesson', 'Alphabet Letters A-Z (Phonics, Formation, Vocabulary)', '4-67'),
    (v_school_id, v_class_id, 'English', '1182', 'kl_lesson', 'Letter A', '4, 5'),
    (v_school_id, v_class_id, 'English', '1183', 'kl_lesson', 'Letter B', '6, 7'),
    (v_school_id, v_class_id, 'English', '1184', 'kl_lesson', 'Letter C', '8, 9'),
    (v_school_id, v_class_id, 'English', '1185', 'kl_lesson', 'Letter D', '10, 11'),
    (v_school_id, v_class_id, 'English', '1186', 'kl_lesson', 'Letter E', '14, 15'),
    (v_school_id, v_class_id, 'English', '1187', 'kl_lesson', 'Letter F', '16, 17'),
    (v_school_id, v_class_id, 'English', '1188', 'kl_lesson', 'Letter G', '18, 19'),
    (v_school_id, v_class_id, 'English', '1189', 'kl_lesson', 'Letter H', '20, 21'),
    (v_school_id, v_class_id, 'English', '1190', 'kl_lesson', 'Letter I', '26, 27'),
    (v_school_id, v_class_id, 'English', '1191', 'kl_lesson', 'Letter J', '28, 29'),
    (v_school_id, v_class_id, 'English', '1192', 'kl_lesson', 'Letter K', '30, 31'),
    (v_school_id, v_class_id, 'English', '1193', 'kl_lesson', 'Letter L', '32, 33'),
    (v_school_id, v_class_id, 'English', '1194', 'kl_lesson', 'Letter M', '36, 37'),
    (v_school_id, v_class_id, 'English', '1195', 'kl_lesson', 'Letter N', '38, 39'),
    (v_school_id, v_class_id, 'English', '1196', 'kl_lesson', 'Letter O', '40, 41'),
    (v_school_id, v_class_id, 'English', '1197', 'kl_lesson', 'Letter P', '42, 43'),
    (v_school_id, v_class_id, 'English', '1198', 'kl_lesson', 'Letter Q', '46, 47'),
    (v_school_id, v_class_id, 'English', '1199', 'kl_lesson', 'Letter R', '48, 49'),
    (v_school_id, v_class_id, 'English', '1200', 'kl_lesson', 'Letter S', '50, 51'),
    (v_school_id, v_class_id, 'English', '1201', 'kl_lesson', 'Letter T', '52, 53'),
    (v_school_id, v_class_id, 'English', '1202', 'kl_lesson', 'Letter U', '56, 57'),
    (v_school_id, v_class_id, 'English', '1203', 'kl_lesson', 'Letter V', '58, 59'),
    (v_school_id, v_class_id, 'English', '1204', 'kl_lesson', 'Letter W', '60, 61'),
    (v_school_id, v_class_id, 'English', '1205', 'kl_lesson', 'Letter X', '62, 63'),
    (v_school_id, v_class_id, 'English', '1206', 'kl_lesson', 'Letter Y', '64, 65'),
    (v_school_id, v_class_id, 'English', '1207', 'kl_lesson', 'Letter Z', '66, 67'),
    -- KL Activities
    (v_school_id, v_class_id, 'English', '653', 'kl_activity', 'Phonics Activities A-Z', '4-67'),
    (v_school_id, v_class_id, 'English', '694', 'kl_activity', 'Letter A Activity', '4, 5'),
    (v_school_id, v_class_id, 'English', '705', 'kl_activity', 'Letter B Activity', '6, 7'),
    (v_school_id, v_class_id, 'English', '708', 'kl_activity', 'Letter C Activity', '8, 9'),
    (v_school_id, v_class_id, 'English', '716', 'kl_activity', 'Letter D Activity', '10, 11'),
    (v_school_id, v_class_id, 'English', '726', 'kl_activity', 'Letter E Activity', '14, 15'),
    (v_school_id, v_class_id, 'English', '731', 'kl_activity', 'Letter F Activity', '16, 17'),
    (v_school_id, v_class_id, 'English', '736', 'kl_activity', 'Letter G Activity', '18, 19'),
    (v_school_id, v_class_id, 'English', '741', 'kl_activity', 'Letter H Activity', '20, 21'),
    (v_school_id, v_class_id, 'English', '745', 'kl_activity', 'Letter I Activity', '26, 27'),
    (v_school_id, v_class_id, 'English', '750', 'kl_activity', 'Letter J Activity', '28, 29'),
    (v_school_id, v_class_id, 'English', '756', 'kl_activity', 'Letter K Activity', '30, 31'),
    (v_school_id, v_class_id, 'English', '760', 'kl_activity', 'Letter L Activity', '32, 33'),
    (v_school_id, v_class_id, 'English', '766', 'kl_activity', 'Letter M Activity', '36, 37'),
    (v_school_id, v_class_id, 'English', '770', 'kl_activity', 'Letter N Activity', '38, 39'),
    (v_school_id, v_class_id, 'English', '776', 'kl_activity', 'Letter O Activity', '40, 41'),
    (v_school_id, v_class_id, 'English', '781', 'kl_activity', 'Letter P Activity', '42, 43'),
    (v_school_id, v_class_id, 'English', '785', 'kl_activity', 'Letter Q Activity', '46, 47'),
    (v_school_id, v_class_id, 'English', '791', 'kl_activity', 'Letter R Activity', '48, 49'),
    (v_school_id, v_class_id, 'English', '796', 'kl_activity', 'Letter S Activity', '50, 51'),
    (v_school_id, v_class_id, 'English', '800', 'kl_activity', 'Letter T Activity', '52, 53'),
    (v_school_id, v_class_id, 'English', '806', 'kl_activity', 'Letter U Activity', '56, 57'),
    (v_school_id, v_class_id, 'English', '810', 'kl_activity', 'Letter V Activity', '58, 59'),
    (v_school_id, v_class_id, 'English', '816', 'kl_activity', 'Letter W Activity', '60, 61'),
    (v_school_id, v_class_id, 'English', '821', 'kl_activity', 'Letter X Activity', '62, 63'),
    (v_school_id, v_class_id, 'English', '825', 'kl_activity', 'Letter Y Activity', '64, 65'),
    (v_school_id, v_class_id, 'English', '831', 'kl_activity', 'Letter Z Activity', '66, 67'),
    -- Interactive Worksheets
    (v_school_id, v_class_id, 'English', 'w9001', 'interactive_worksheet', 'Alphabet song', '3'),
    (v_school_id, v_class_id, 'English', 'w9002', 'interactive_worksheet', 'Letter A', '4, 5'),
    (v_school_id, v_class_id, 'English', 'w9003', 'interactive_worksheet', 'Letter B', '6, 7'),
    (v_school_id, v_class_id, 'English', 'w9004', 'interactive_worksheet', 'Letter C', '8, 9'),
    (v_school_id, v_class_id, 'English', 'w9005', 'interactive_worksheet', 'Letter D', '10, 11'),
    (v_school_id, v_class_id, 'English', 'w9006', 'interactive_worksheet', 'Activity: A-D', '12'),
    (v_school_id, v_class_id, 'English', 'w9007', 'interactive_worksheet', 'Activity: A-D', '13'),
    (v_school_id, v_class_id, 'English', 'w9008', 'interactive_worksheet', 'Letter E', '14, 15'),
    (v_school_id, v_class_id, 'English', 'w9009', 'interactive_worksheet', 'Letter F', '16, 17'),
    (v_school_id, v_class_id, 'English', 'w9010', 'interactive_worksheet', 'Letter G', '18, 19'),
    (v_school_id, v_class_id, 'English', 'w9011', 'interactive_worksheet', 'Letter H', '20, 21'),
    (v_school_id, v_class_id, 'English', 'w9012', 'interactive_worksheet', 'Activity: A-H', '22'),
    (v_school_id, v_class_id, 'English', 'w9013', 'interactive_worksheet', 'Activity: A-H', '23'),
    (v_school_id, v_class_id, 'English', 'w9014', 'interactive_worksheet', 'Activity: A-H', '24'),
    (v_school_id, v_class_id, 'English', 'w9015', 'interactive_worksheet', 'Activity: A-H', '25'),
    (v_school_id, v_class_id, 'English', 'w9016', 'interactive_worksheet', 'Letter I', '26, 27'),
    (v_school_id, v_class_id, 'English', 'w9017', 'interactive_worksheet', 'Letter J', '28, 29'),
    (v_school_id, v_class_id, 'English', 'w9018', 'interactive_worksheet', 'Letter K', '30, 31'),
    (v_school_id, v_class_id, 'English', 'w9019', 'interactive_worksheet', 'Letter L', '32, 33'),
    (v_school_id, v_class_id, 'English', 'w9020', 'interactive_worksheet', 'Activity: I-L', '34'),
    (v_school_id, v_class_id, 'English', 'w9021', 'interactive_worksheet', 'Activity: I-L', '35'),
    (v_school_id, v_class_id, 'English', 'w9022', 'interactive_worksheet', 'Letter M', '36, 37'),
    (v_school_id, v_class_id, 'English', 'w9023', 'interactive_worksheet', 'Letter N', '38, 39'),
    (v_school_id, v_class_id, 'English', 'w9024', 'interactive_worksheet', 'Letter O', '40, 41'),
    (v_school_id, v_class_id, 'English', 'w9025', 'interactive_worksheet', 'Letter P', '42, 43'),
    (v_school_id, v_class_id, 'English', 'w9026', 'interactive_worksheet', 'Activity: M-P', '44'),
    (v_school_id, v_class_id, 'English', 'w9027', 'interactive_worksheet', 'Activity: M-P', '45'),
    (v_school_id, v_class_id, 'English', 'w9028', 'interactive_worksheet', 'Letter Q', '46, 47'),
    (v_school_id, v_class_id, 'English', 'w9029', 'interactive_worksheet', 'Letter R', '48, 49'),
    (v_school_id, v_class_id, 'English', 'w9030', 'interactive_worksheet', 'Letter S', '50, 51'),
    (v_school_id, v_class_id, 'English', 'w9031', 'interactive_worksheet', 'Letter T', '52, 53'),
    (v_school_id, v_class_id, 'English', 'w9032', 'interactive_worksheet', 'Activity: Q-T', '54'),
    (v_school_id, v_class_id, 'English', 'w9033', 'interactive_worksheet', 'Activity: Q-T', '55'),
    (v_school_id, v_class_id, 'English', 'w9034', 'interactive_worksheet', 'Letter U', '56, 57'),
    (v_school_id, v_class_id, 'English', 'w9035', 'interactive_worksheet', 'Letter V', '58, 59'),
    (v_school_id, v_class_id, 'English', 'w9036', 'interactive_worksheet', 'Letter W', '60, 61'),
    (v_school_id, v_class_id, 'English', 'w9037', 'interactive_worksheet', 'Letter X', '62, 63'),
    (v_school_id, v_class_id, 'English', 'w9038', 'interactive_worksheet', 'Letter Y', '64, 65'),
    (v_school_id, v_class_id, 'English', 'w9039', 'interactive_worksheet', 'Letter Z', '66, 67'),
    (v_school_id, v_class_id, 'English', 'w9040', 'interactive_worksheet', 'Activity: U-Z', '68'),
    (v_school_id, v_class_id, 'English', 'w9041', 'interactive_worksheet', 'Activity: U-Z', '69'),
    (v_school_id, v_class_id, 'English', 'w9042', 'interactive_worksheet', 'Activity: U-Z', '70'),
    (v_school_id, v_class_id, 'English', 'w9043', 'interactive_worksheet', 'Activity: U-Z', '71'),
    (v_school_id, v_class_id, 'English', 'w9044', 'interactive_worksheet', 'Activity: A-Z', '72'),
    (v_school_id, v_class_id, 'English', 'w9045', 'interactive_worksheet', 'Activity: A-Z', '73'),
    (v_school_id, v_class_id, 'English', 'w9046', 'interactive_worksheet', 'Uppercase and lowercase writing', '74'),
    (v_school_id, v_class_id, 'English', 'w9047', 'interactive_worksheet', 'Uppercase and lowercase writing', '75'),
    (v_school_id, v_class_id, 'English', 'w9048', 'interactive_worksheet', 'Uppercase and lowercase writing', '76, 77'),
    (v_school_id, v_class_id, 'English', 'w9049', 'interactive_worksheet', 'Activity: A-Z', '78'),
    (v_school_id, v_class_id, 'English', 'w9050', 'interactive_worksheet', 'Activities', '79'),
    (v_school_id, v_class_id, 'English', 'w9051', 'interactive_worksheet', 'Activities', '80')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted English resources for Jr. KG: %', (SELECT COUNT(*) FROM curriculum_resources WHERE school_id = v_school_id AND class_id = v_class_id AND subject = 'English');
END $$;


-- Seed: English Reading curriculum resources for Jr. KG (SOJ)
DO $$
DECLARE
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'soj';
  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id AND LOWER(name) LIKE '%jr%kg%' LIMIT 1;

  IF v_school_id IS NULL OR v_class_id IS NULL THEN
    RAISE NOTICE 'School or class not found, skipping English Reading seed';
    RETURN;
  END IF;

  INSERT INTO curriculum_resources (school_id, class_id, subject, resource_id, resource_type, topic, book_page) VALUES
    -- KL Lessons (Reading Book)
    (v_school_id, v_class_id, 'English Reading', '1575', 'kl_lesson', 'English Reader (Reading Practice Book)', '3-32'),
    (v_school_id, v_class_id, 'English Reading', '1209', 'kl_lesson', '"at" and "an" words', '4'),
    (v_school_id, v_class_id, 'English Reading', '1210', 'kl_lesson', '"at" and "an" words', '4'),
    (v_school_id, v_class_id, 'English Reading', '1213', 'kl_lesson', '"ap" and "ag" words', '5'),
    (v_school_id, v_class_id, 'English Reading', '1214', 'kl_lesson', '"ap" and "ag" words', '5'),
    (v_school_id, v_class_id, 'English Reading', '1218', 'kl_lesson', '"en" and "ed" words', '8'),
    (v_school_id, v_class_id, 'English Reading', '1219', 'kl_lesson', '"en" and "ed" words', '8'),
    (v_school_id, v_class_id, 'English Reading', '1220', 'kl_lesson', '"et" and "eg" words', '9'),
    (v_school_id, v_class_id, 'English Reading', '1217', 'kl_lesson', '"et" and "eg" words', '9'),
    (v_school_id, v_class_id, 'English Reading', '1224', 'kl_lesson', '"it" and "in" words', '10'),
    (v_school_id, v_class_id, 'English Reading', '1226', 'kl_lesson', '"it" and "in" words', '10'),
    (v_school_id, v_class_id, 'English Reading', '1228', 'kl_lesson', '"ip" and "ig" words', '11'),
    (v_school_id, v_class_id, 'English Reading', '1229', 'kl_lesson', '"ip" and "ig" words', '11'),
    (v_school_id, v_class_id, 'English Reading', '1234', 'kl_lesson', '"ot" and "op" words', '12'),
    (v_school_id, v_class_id, 'English Reading', '1237', 'kl_lesson', '"ot" and "op" words', '12'),
    (v_school_id, v_class_id, 'English Reading', '1239', 'kl_lesson', '"oy" and "og" words', '13'),
    (v_school_id, v_class_id, 'English Reading', '1236', 'kl_lesson', '"oy" and "og" words', '13'),
    (v_school_id, v_class_id, 'English Reading', '1243', 'kl_lesson', '"ut" and "ub" words', '14'),
    (v_school_id, v_class_id, 'English Reading', '1247', 'kl_lesson', '"ut" and "ub" words', '14'),
    (v_school_id, v_class_id, 'English Reading', '1244', 'kl_lesson', '"un" and "ug" words', '15'),
    (v_school_id, v_class_id, 'English Reading', '1246', 'kl_lesson', '"un" and "ug" words', '15'),
    (v_school_id, v_class_id, 'English Reading', '1521', 'kl_lesson', 'Sight words', '17, 24')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted English Reading resources for Jr. KG: %', (SELECT COUNT(*) FROM curriculum_resources WHERE school_id = v_school_id AND class_id = v_class_id AND subject = 'English Reading');
END $$;
