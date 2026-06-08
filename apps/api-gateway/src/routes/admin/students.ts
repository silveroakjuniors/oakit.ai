import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadFile, deleteFile, getPublicUrl } from '../../lib/storage';
import { assignFeeStructureToStudent } from '../../lib/feeAssignment';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope);

// Use memory/temp storage ? file goes to Supabase, not disk
const photoUpload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Photo must be JPEG or PNG'));
  },
});

const xlsxUpload = multer({ dest: '/tmp/oakit-uploads/' });

// - Normalise column header -
function normalise(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// - Extract plain text from ExcelJS cell value (handles rich text, formulas, etc.) -
function cellText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // Rich text: { richText: [{ text: '...' }, ...] }
  if (value.richText && Array.isArray(value.richText)) {
    return value.richText.map((r: any) => r.text || '').join('');
  }
  // Formula result
  if (value.result !== undefined) return String(value.result);
  // Date
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Fallback
  return String(value);
}

// - POST /api/v1/admin/students — create a single student -
router.post('/', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { name, class_id, section_id, father_name, mother_name, parent_contact, mother_contact, fee_assignment } = req.body;
    // fee_assignment?: { fee_structure_id: string; fee_type: 'term' | 'annual' }

    if (!name || !class_id || !section_id) {
      return res.status(400).json({ error: 'name, class_id, and section_id are required' });
    }
    if (parent_contact && mother_contact && parent_contact.trim() === mother_contact.trim()) {
      return res.status(400).json({ error: 'Father and mother cannot have the same mobile number' });
    }
    if (parent_contact && !/^\d{10}$/.test(parent_contact.trim())) {
      return res.status(400).json({ error: 'Father mobile must be 10 digits' });
    }
    if (mother_contact && !/^\d{10}$/.test(mother_contact.trim())) {
      return res.status(400).json({ error: 'Mother mobile must be 10 digits' });
    }

    // Require a tuition or admission fee head assigned to this class before onboarding
    const feeCheck = await pool.query(
      `SELECT fh.id
       FROM fee_heads fh
       WHERE fh.school_id = $1
         AND fh.class_id = $2
         AND fh.type IN ('tuition', 'admission')
         AND fh.deleted_at IS NULL
       LIMIT 1`,
      [school_id, class_id]
    );
    if (feeCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'Cannot onboard student: no tuition or annual fee has been assigned to this class. Please set up a fee structure for this class first.',
      });
    }

    // When fee_assignment is provided, wrap everything in a transaction
    if (fee_assignment) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const insertResult = await client.query(
          `INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name`,
          [school_id, class_id, section_id, name.trim(),
           father_name?.trim() || null, mother_name?.trim() || null,
           parent_contact?.trim() || null, mother_contact?.trim() || null]
        );
        const student = insertResult.rows[0];

        let feeAccountsCreated = 0;
        try {
          const assignResult = await assignFeeStructureToStudent({
            studentId: student.id,
            schoolId: school_id,
            feeStructureId: fee_assignment.fee_structure_id,
            classId: class_id,
            client,
          });
          feeAccountsCreated = assignResult.fee_accounts_created;
        } catch (assignErr: any) {
          await client.query('ROLLBACK');
          if (assignErr.message === "Fee structure does not match the student's class") {
            return res.status(400).json({ error: assignErr.message });
          }
          throw assignErr;
        }

        await client.query('COMMIT');
        return res.status(201).json({ ...student, fee_accounts_created: feeAccountsCreated });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // No fee_assignment — keep existing simple pool.query approach
    const result = await pool.query(
      `INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name`,
      [school_id, class_id, section_id, name.trim(),
       father_name?.trim() || null, mother_name?.trim() || null,
       parent_contact?.trim() || null, mother_contact?.trim() || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - GET /api/v1/admin/students � list students
router.get('/', roleGuard('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, include_inactive, incomplete_parents, search } = req.query;
    let query = `
      SELECT s.id, s.name, s.father_name, s.mother_name,
             s.parent_contact, s.mother_contact,
             s.photo_path,
             s.is_active,
             s.class_id, s.section_id,
             c.name as class_name, sec.label as section_label
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
      WHERE s.school_id = $1`;
    const params: any[] = [school_id];
    if (!include_inactive || include_inactive !== 'true') { query += ' AND s.is_active = true'; }
    if (class_id)   { params.push(class_id);   query += ` AND s.class_id = $${params.length}`; }
    if (section_id) { params.push(section_id); query += ` AND s.section_id = $${params.length}`; }
    // Filter: students with any missing parent detail
    if (incomplete_parents === 'true') {
      query += ` AND (
        s.father_name IS NULL OR s.father_name = '' OR
        s.parent_contact IS NULL OR s.parent_contact = '' OR
        s.mother_name IS NULL OR s.mother_name = '' OR
        s.mother_contact IS NULL OR s.mother_contact = ''
      )`;
    }
    // Full-text search across name, parent names, and phone numbers
    if (search) {
      const searchTerm = `%${(search as string).toLowerCase()}%`;
      params.push(searchTerm);
      query += ` AND (
        LOWER(s.name) LIKE $${params.length} OR
        LOWER(COALESCE(s.father_name, '')) LIKE $${params.length} OR
        LOWER(COALESCE(s.mother_name, '')) LIKE $${params.length} OR
        COALESCE(s.parent_contact, '') LIKE $${params.length} OR
        COALESCE(s.mother_contact, '') LIKE $${params.length}
      )`;
    }
    query += ' ORDER BY s.name';
    const result = await pool.query(query, params);
    return res.json(result.rows.map((r: any) => ({ ...r, photo_url: getPublicUrl(r.photo_path) })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - GET /api/v1/admin/students/export -
router.get('/export', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id } = req.query;

    let query = `
      SELECT s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
             s.date_of_birth, s.is_active,
             c.name as class_name, sec.label as section_label
      FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN sections sec ON sec.id = s.section_id
      WHERE s.school_id = $1
    `;
    const params: any[] = [school_id];

    if (class_id) {
      params.push(class_id);
      query += ` AND s.class_id = $${params.length}`;
    }
    if (section_id) {
      params.push(section_id);
      query += ` AND s.section_id = $${params.length}`;
    }

    query += ' ORDER BY c.name, sec.label, s.name';

    const result = await pool.query(query, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');

    ws.columns = [
      { header: 'Student Name', width: 24 },
      { header: 'Class', width: 12 },
      { header: 'Section', width: 10 },
      { header: 'Father Name', width: 22 },
      { header: 'Mother Name', width: 22 },
      { header: 'Father Contact Number', width: 20 },
      { header: 'Mother Contact Number', width: 20 },
      { header: 'Date of Birth', width: 14 },
      { header: 'Status', width: 10 },
    ];

    // Style header row
    ws.getRow(1).font = { bold: true };

    for (const row of result.rows) {
      ws.addRow([
        row.name,
        row.class_name,
        row.section_label,
        row.father_name || '',
        row.mother_name || '',
        row.parent_contact || '',
        row.mother_contact || '',
        row.date_of_birth || '',
        row.is_active ? 'Active' : 'Inactive',
      ]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students_export.xlsx"');
    const buf = await wb.xlsx.writeBuffer();
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - GET /api/v1/admin/students/import/template -
router.get('/import/template', roleGuard('admin'), async (_req: Request, res: Response) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  ws.columns = [
    { header: 'student name', width: 22 },
    { header: 'father name', width: 20 },
    { header: 'mother name', width: 20 },
    { header: 'section', width: 10 },
    { header: 'class', width: 12 },
    { header: 'father mobile', width: 18 },
    { header: 'mother mobile', width: 18 },
  ];
  ws.addRow(['Aarav Sharma', 'Rajesh Sharma', 'Priya Sharma', 'A', 'UKG', '9876543210', '9876543211']);
  ws.addRow(['Diya Patel', 'Suresh Patel', 'Meena Patel', 'B', 'LKG', '9123456789', '']);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.xlsx"');
  const buf = await wb.xlsx.writeBuffer();
  return res.send(buf);
});

// - POST /api/v1/admin/students/import -
router.post('/import', roleGuard('admin'), xlsxUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(file.path);
    } finally {
      fs.unlink(file.path, () => {});
    }

    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'File is empty or has no sheets' });

    // Get headers from first row
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNum) => { headers[colNum - 1] = cellText(cell.value); });

    const colMap: Record<string, number> = {};
headers.forEach((h, i) => {
  const n = normalise(h);

  if (n === 'studentname' || n === 'name' || n === 'childname' || n === 'studentsname') {
    colMap.student_name = i;
  }

  else if (n === 'fathername' || n === 'fathersname' || n === 'dadname') {
    colMap.father_name = i;
  }

  else if (n === 'mothername' || n === 'mothersname' || n === 'momname') {
    colMap.mother_name = i;
  }

  else if (n === 'section' || n === 'sec') {
    colMap.section = i;
  }

  else if (n === 'class' || n === 'classname' || n === 'grade') {
    colMap.class = i;
  }

  else if (n === 'parentcontactnumber' || n === 'fathercontactnumber' || n === 'fathermobile' || n === 'fatherphone' || n === 'fathermobilenumber' || n === 'parentnumber' || n === 'parentmobile' || n === 'fatherno' || n === 'dadmobile' || n === 'fathernumber' || n === 'parentmobilenumber') {
    colMap.parent_contact = i;
  }

  else if (n === 'mothercontactnumber' || n === 'mothermobile' || n === 'motherphone' || n === 'mothermobilenumber' || n === 'motherno' || n === 'mommobile' || n === 'mothernumber') {
    colMap.mother_contact = i;
  }
});

    if (colMap.student_name === undefined) return res.status(400).json({ error: 'Column "student name" not found in file' });
    if (colMap.class === undefined) return res.status(400).json({ error: 'Column "class" not found in file' });
    if (colMap.section === undefined) return res.status(400).json({ error: 'Column "section" not found in file' });

    // Validate ALL required columns are present
    const requiredColumns: { key: string; label: string }[] = [
      { key: 'student_name', label: 'student name' },
      { key: 'father_name', label: 'father name' },
      { key: 'mother_name', label: 'mother name' },
      { key: 'section', label: 'section' },
      { key: 'class', label: 'class' },
      { key: 'parent_contact', label: 'father mobile' },
      { key: 'mother_contact', label: 'mother mobile' },
    ];

    const missingColumns = requiredColumns
      .filter(col => colMap[col.key] === undefined)
      .map(col => `"${col.label}"`);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}. Please use the import template with all required headers: student name, father name, mother name, section, class, father mobile, mother mobile.`
      });
    }
    const rows: any[][] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const vals: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => { vals[colNum - 1] = cell.value; });
      rows.push(vals);
    });

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty or has no data rows' });

    let created = 0;
    let updated = 0;
    const skipped: any[] = [];

    for (const row of rows) {
      const studentName   = cellText(row[colMap.student_name]).trim();
      const fatherName    = colMap.father_name !== undefined ? cellText(row[colMap.father_name]).trim() : '';
      const motherName    = colMap.mother_name !== undefined ? cellText(row[colMap.mother_name]).trim() : '';
      const sectionLabel  = cellText(row[colMap.section]).trim();
      const className     = cellText(row[colMap.class]).trim();
      const parentContact = colMap.parent_contact !== undefined ? cellText(row[colMap.parent_contact]).trim().replace(/[^0-9]/g, '') : '';
      const motherContact = colMap.mother_contact !== undefined ? cellText(row[colMap.mother_contact]).trim().replace(/[^0-9]/g, '') : '';

      if (!studentName || !className || !sectionLabel) {
        skipped.push({ studentName, reason: 'Missing student name, class, or section' });
        continue;
      }

      const classRow = await pool.query(
        'SELECT id FROM classes WHERE school_id = $1 AND LOWER(name) = LOWER($2)',
        [school_id, className]
      );
      if (classRow.rows.length === 0) { skipped.push({ studentName, reason: `Class '${className}' not found` }); continue; }

      const sectionRow = await pool.query(
        'SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(label) = LOWER($3)',
        [school_id, classRow.rows[0].id, sectionLabel]
      );
      if (sectionRow.rows.length === 0) { skipped.push({ studentName, reason: `Section '${sectionLabel}' not found in class '${className}'` }); continue; }

try {
  // Check for duplicate: multiple strategies
  // 1. Match on name + father name + mother name
  // 2. Match on name + father contact number
  // 3. Match on name + mother contact number
  let existingStudent = await pool.query(
    `SELECT id, class_id, section_id
     FROM students
     WHERE school_id = $1
       AND LOWER(TRIM(name)) = LOWER($2)
       AND (
         (LOWER(COALESCE(TRIM(father_name), '')) = LOWER($3) AND LOWER(COALESCE(TRIM(mother_name), '')) = LOWER($4))
         OR ($5 <> '' AND COALESCE(parent_contact, '') = $5)
         OR ($6 <> '' AND COALESCE(mother_contact, '') = $6)
       )
     LIMIT 1`,
    [
      school_id,
      studentName.toLowerCase(),
      (fatherName || '').toLowerCase(),
      (motherName || '').toLowerCase(),
      parentContact || '',
      motherContact || ''
    ]
  );

  if (existingStudent.rows.length > 0) {
    const existing = existingStudent.rows[0];
    if (existing.class_id !== classRow.rows[0].id || existing.section_id !== sectionRow.rows[0].id) {
      // Student exists in a different class/section - reject
      skipped.push({ studentName, reason: `Duplicate student already exists in a different class/section. Use student management to transfer.` });
      continue;
    }
    // Same class/section - update contact details
    await pool.query(
      `UPDATE students
       SET parent_contact = COALESCE(NULLIF($1, ''), parent_contact),
           mother_contact = COALESCE(NULLIF($2, ''), mother_contact),
           father_name = COALESCE(NULLIF($3, ''), father_name),
           mother_name = COALESCE(NULLIF($4, ''), mother_name)
       WHERE id = $5`,
      [
        parentContact || '',
        motherContact || '',
        fatherName || '',
        motherName || '',
        existing.id
      ]
    );
    updated++;
    continue;
  }

  // INSERT new student
  await pool.query(
    `INSERT INTO students
     (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      school_id,
      classRow.rows[0].id,
      sectionRow.rows[0].id,
      studentName,
      fatherName || null,
      motherName || null,
      parentContact || null,
      motherContact || null
    ]
  );

  created++;

} catch (err: any) {
  skipped.push({ studentName, reason: err.message });
}
    }

    return res.json({ total: rows.length, created, updated, skipped, columns_detected: colMap });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Bulk Activate Parent Logins -------------------------------------------

// POST /api/v1/admin/students/bulk-activate-parents
// Activates parent logins for a list of students using their stored
// parent_contact (father) and/or mother_contact numbers.
// Skips students that have no contact numbers on file.
router.post('/bulk-activate-parents', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const { student_ids, relation } = req.body as {
      student_ids: string[];
      relation: 'father' | 'mother' | 'both';
    };

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'student_ids array is required' });
    }
    if (!['father', 'mother', 'both'].includes(relation)) {
      return res.status(400).json({ error: 'relation must be "father", "mother", or "both"' });
    }

    const bcrypt = require('bcryptjs');

    // Fetch all requested students in one query
    const studentsResult = await client.query(
      `SELECT id, name, father_name, mother_name, parent_contact, mother_contact
       FROM students
       WHERE id = ANY($1::uuid[]) AND school_id = $2 AND is_active = true`,
      [student_ids, school_id]
    );

    await client.query('BEGIN');

    const activated: { student_name: string; mobile: string; relation: string }[] = [];
    const skipped:   { student_name: string; reason: string }[] = [];

    async function activateOne(
      studentId: string,
      studentName: string,
      mobile: string,
      parentName: string | null,
      rel: 'father' | 'mother' | 'guardian',
    ) {
      if (!mobile || !/^\d{10}$/.test(mobile.trim())) {
        skipped.push({ student_name: studentName, reason: `${rel} mobile "${mobile}" is not a valid 10-digit number` });
        return;
      }
      const m = mobile.trim();
      const hash = await bcrypt.hash(m, 12);

      // Upsert parent_users
      const existing = await client.query(
        'SELECT id FROM parent_users WHERE mobile = $1 AND school_id = $2',
        [m, school_id]
      );
      let parentId: string;
      if (existing.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
           VALUES ($1, $2, $3, $4, true, true) RETURNING id`,
          [school_id, m, parentName || null, hash]
        );
        parentId = ins.rows[0].id;
      } else {
        parentId = existing.rows[0].id;
        await client.query(
          `UPDATE parent_users SET password_hash = $1, force_password_reset = true, is_active = true WHERE id = $2`,
          [hash, parentId]
        );
      }

      // Link to student
      await client.query(
        `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [parentId, studentId]
      );

      activated.push({ student_name: studentName, mobile: m, relation: rel });
    }

    for (const student of studentsResult.rows) {
      const hasFather = student.parent_contact && /^\d{10}$/.test(student.parent_contact.trim());
      const hasMother = student.mother_contact && /^\d{10}$/.test(student.mother_contact.trim());

      if (relation === 'father' || relation === 'both') {
        if (hasFather) {
          await activateOne(student.id, student.name, student.parent_contact, student.father_name, 'father');
        } else if (relation === 'father') {
          skipped.push({ student_name: student.name, reason: 'No valid father mobile on file' });
        }
      }

      if (relation === 'mother' || relation === 'both') {
        if (hasMother) {
          await activateOne(student.id, student.name, student.mother_contact, student.mother_name, 'mother');
        } else if (relation === 'mother') {
          skipped.push({ student_name: student.name, reason: 'No valid mother mobile on file' });
        }
      }

      // If "both" and neither contact exists, add a single skip entry
      if (relation === 'both' && !hasFather && !hasMother) {
        skipped.push({ student_name: student.name, reason: 'No valid parent contacts on file' });
      }
    }

    // Students in the request that weren't found / inactive
    const foundIds = new Set(studentsResult.rows.map((r: any) => r.id));
    for (const id of student_ids) {
      if (!foundIds.has(id)) {
        skipped.push({ student_name: id, reason: 'Student not found or inactive' });
      }
    }

    await client.query('COMMIT');

    return res.json({
      activated: activated.length,
      skipped:   skipped.length,
      details:   { activated, skipped },
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bulk-activate-parents]', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  } finally {
    client.release();
  }
});

// --- Student Dashboard (counts by class) -------------------------------------

// GET /api/v1/admin/students/dashboard
router.get('/dashboard', roleGuard('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // 1. Total active students
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS total FROM students WHERE school_id = $1 AND is_active = true`,
      [school_id]
    );

    // 2. Parent activation/login stats (school-wide)
    const parentStatsRow = await pool.query(
      `SELECT
         COUNT(DISTINCT s.id)::int AS total_students,
         COUNT(DISTINCT psl.student_id)::int AS parents_activated,
         COUNT(DISTINCT CASE WHEN pu.last_login IS NOT NULL THEN psl.student_id END)::int AS parents_logged_in,
         COUNT(DISTINCT CASE WHEN pu.last_login IS NULL AND pu.id IS NOT NULL THEN psl.student_id END)::int AS parents_not_logged_in
       FROM students s
       LEFT JOIN parent_student_links psl ON psl.student_id = s.id
       LEFT JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
       WHERE s.school_id = $1 AND s.is_active = true`,
      [school_id]
    );
    const parentStats = parentStatsRow.rows[0];

    // 3. Per-class counts + contact completeness + parent activation
    const byClassRow = await pool.query(
      `SELECT
         c.id   AS class_id,
         c.name AS class_name,
         COUNT(DISTINCT s.id)::int AS total_students,
         COUNT(DISTINCT s.id) FILTER (WHERE s.father_name    IS NOT NULL AND s.father_name    <> '')::int AS with_father,
         COUNT(DISTINCT s.id) FILTER (WHERE s.mother_name    IS NOT NULL AND s.mother_name    <> '')::int AS with_mother,
         COUNT(DISTINCT s.id) FILTER (WHERE s.parent_contact IS NOT NULL AND s.parent_contact <> '')::int AS with_father_contact,
         COUNT(DISTINCT s.id) FILTER (WHERE s.mother_contact IS NOT NULL AND s.mother_contact <> '')::int AS with_mother_contact,
         COUNT(DISTINCT psl.student_id)::int AS parents_activated,
         COUNT(DISTINCT CASE WHEN pu.last_login IS NOT NULL THEN psl.student_id END)::int AS parents_logged_in,
         COUNT(DISTINCT CASE WHEN pu.last_login IS NULL AND pu.id IS NOT NULL THEN psl.student_id END)::int AS parents_not_logged_in
       FROM classes c
       LEFT JOIN students s
         ON s.class_id = c.id AND s.school_id = c.school_id AND s.is_active = true
       LEFT JOIN parent_student_links psl ON psl.student_id = s.id
       LEFT JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
       WHERE c.school_id = $1
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      [school_id]
    );

    // 3. Per-section counts (separate query — avoids json_agg complexity)
    const bySectionRow = await pool.query(
      `SELECT
         sec.class_id,
         sec.id    AS section_id,
         sec.label AS section_label,
         COUNT(s.id)::int AS count
       FROM sections sec
       LEFT JOIN students s
         ON s.section_id = sec.id AND s.school_id = sec.school_id AND s.is_active = true
       WHERE sec.school_id = $1
       GROUP BY sec.class_id, sec.id, sec.label
       ORDER BY sec.label`,
      [school_id]
    );

    // Group sections by class_id
    const sectionsByClass: Record<string, { section_id: string; section_label: string; count: number }[]> = {};
    for (const row of bySectionRow.rows) {
      if (!sectionsByClass[row.class_id]) sectionsByClass[row.class_id] = [];
      sectionsByClass[row.class_id].push({
        section_id:    row.section_id,
        section_label: row.section_label,
        count:         row.count,
      });
    }

    const byClass = byClassRow.rows.map((r: any) => ({
      ...r,
      sections: sectionsByClass[r.class_id] || [],
    }));

    return res.json({
      total_students: totalRow.rows[0].total,
      parent_stats: {
        activated: parentStats.parents_activated,
        logged_in: parentStats.parents_logged_in,
        not_logged_in: parentStats.parents_not_logged_in,
        not_activated: totalRow.rows[0].total - parentStats.parents_activated,
      },
      by_class: byClass,
    });
  } catch (err: any) {
    console.error('[students/dashboard]', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
});

// GET /api/v1/admin/students/dashboard/details?class_id=&status=activated|logged_in|not_logged_in|not_activated
router.get('/dashboard/details', roleGuard('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, status } = req.query as Record<string, string>;

    let query = '';
    const params: any[] = [school_id];

    if (status === 'not_activated') {
      // Students with no parent_student_links entry
      query = `
        SELECT s.id, s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
               c.name AS class_name, sec.label AS section_label
        FROM students s
        JOIN classes c ON c.id = s.class_id
        JOIN sections sec ON sec.id = s.section_id
        LEFT JOIN parent_student_links psl ON psl.student_id = s.id
        WHERE s.school_id = $1 AND s.is_active = true AND psl.student_id IS NULL
      `;
    } else if (status === 'logged_in') {
      // Students whose parent has logged in at least once
      query = `
        SELECT DISTINCT s.id, s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
               c.name AS class_name, sec.label AS section_label, pu.last_login
        FROM students s
        JOIN classes c ON c.id = s.class_id
        JOIN sections sec ON sec.id = s.section_id
        JOIN parent_student_links psl ON psl.student_id = s.id
        JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
        WHERE s.school_id = $1 AND s.is_active = true AND pu.last_login IS NOT NULL
      `;
    } else if (status === 'not_logged_in') {
      // Students whose parent is activated but never logged in
      query = `
        SELECT DISTINCT s.id, s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
               c.name AS class_name, sec.label AS section_label
        FROM students s
        JOIN classes c ON c.id = s.class_id
        JOIN sections sec ON sec.id = s.section_id
        JOIN parent_student_links psl ON psl.student_id = s.id
        JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
        WHERE s.school_id = $1 AND s.is_active = true AND pu.last_login IS NULL
      `;
    } else {
      // activated = all students with parent links
      query = `
        SELECT DISTINCT s.id, s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
               c.name AS class_name, sec.label AS section_label, pu.last_login
        FROM students s
        JOIN classes c ON c.id = s.class_id
        JOIN sections sec ON sec.id = s.section_id
        JOIN parent_student_links psl ON psl.student_id = s.id
        JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
        WHERE s.school_id = $1 AND s.is_active = true
      `;
    }

    if (class_id) { params.push(class_id); query += ` AND s.class_id = $${params.length}`; }
    if (section_id) { params.push(section_id); query += ` AND s.section_id = $${params.length}`; }
    query += ' ORDER BY c.name, sec.label, s.name';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[students/dashboard/details]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - GET /api/v1/admin/students/:id -
router.get('/:id', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.*, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON s.class_id = c.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = $1 AND s.school_id = $2`,
      [req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = result.rows[0];
    student.photo_url = getPublicUrl(student.photo_path);
    return res.json(student);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/photo -
router.post('/:id/photo', roleGuard('admin'), (req: Request, res: Response, next: any) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Photo must be under 5 MB' });
      return res.status(400).json({ error: err.message || 'Photo must be JPEG or PNG' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No photo uploaded' });
    const studentRow = await pool.query(
      'SELECT id, photo_path FROM students WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (studentRow.rows.length === 0) { fs.unlink(file.path, () => {}); return res.status(404).json({ error: 'Student not found' }); }

    // Delete old photo from Supabase
    await deleteFile(studentRow.rows[0].photo_path);

    // Upload new photo to Supabase
    const { storagePath, publicUrl } = await uploadFile({
      schoolId: school_id,
      folder: 'students',
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      actorId: req.user!.user_id,
      actorRole: 'admin',
      entityType: 'student_photo',
      entityId: req.params.id,
      auditMeta: { student_id: req.params.id },
    });

    await pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [storagePath, req.params.id]);
    return res.json({ photo_url: publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/activate-parent -
// Creates a parent account using father or mother contact, links to student
router.post('/:id/activate-parent', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { mobile, name, relation } = req.body; // relation: 'father' | 'mother' | 'guardian'
    if (!mobile) return res.status(400).json({ error: 'mobile is required' });
    if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ error: 'Mobile must be 10 digits' });

    const studentRow = await pool.query(
      'SELECT id, name, parent_contact, mother_contact FROM students WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRow.rows[0];

    // Enforce one father / one mother:
    // If relation is 'father', the father slot is student.parent_contact
    // If relation is 'mother', the mother slot is student.mother_contact
    // If a different parent is already linked for that slot, unlink them first
    if (relation === 'father' || relation === 'mother') {
      const slotMobile = relation === 'father' ? student.parent_contact : student.mother_contact;
      if (slotMobile && slotMobile !== mobile) {
        // Find and unlink the existing parent for this slot
        const existingParent = await pool.query(
          'SELECT id FROM parent_users WHERE mobile = $1 AND school_id = $2',
          [slotMobile, school_id]
        );
        if (existingParent.rows.length > 0) {
          await pool.query(
            'DELETE FROM parent_student_links WHERE student_id = $1 AND parent_id = $2',
            [req.params.id, existingParent.rows[0].id]
          );
        }
      }
    }

    // Check if parent account already exists
    let parentRow = await pool.query(
      'SELECT id, is_active FROM parent_users WHERE mobile = $1 AND school_id = $2',
      [mobile, school_id]
    );

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(mobile, 12);

    if (parentRow.rows.length === 0) {
      parentRow = await pool.query(
        `INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset, is_active)
         VALUES ($1, $2, $3, $4, true, true) RETURNING id`,
        [school_id, mobile, name || null, hash]
      );
    } else {
      await pool.query(
        `UPDATE parent_users SET password_hash = $1, force_password_reset = true, is_active = true WHERE id = $2`,
        [hash, parentRow.rows[0].id]
      );
    }

    // Link parent to student
    await pool.query(
      `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [parentRow.rows[0].id, req.params.id]
    );

    return res.status(201).json({
      parent_id: parentRow.rows[0].id,
      mobile,
      message: `Parent account activated. Login: mobile=${mobile}, password=${mobile} (must change on first login)`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/reset-parent-login -
router.post('/:id/reset-parent-login', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { parent_id } = req.body;
    if (!parent_id) return res.status(400).json({ error: 'parent_id is required' });

    const parentRow = await pool.query(
      'SELECT id, mobile FROM parent_users WHERE id = $1 AND school_id = $2',
      [parent_id, school_id]
    );
    if (parentRow.rows.length === 0) return res.status(404).json({ error: 'Parent not found' });

    const bcrypt = require('bcryptjs');
    const mobile = parentRow.rows[0].mobile;
    const hash = await bcrypt.hash(mobile, 12);

    await pool.query(
      `UPDATE parent_users SET password_hash = $1, force_password_reset = true WHERE id = $2`,
      [hash, parent_id]
    );

    return res.json({ message: `Password reset to mobile number. Parent must change on next login.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - GET /api/v1/admin/students/:id/parents -
router.get('/:id/parents', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT pu.id, pu.name, pu.mobile, pu.is_active, pu.force_password_reset
       FROM parent_student_links psl
       JOIN parent_users pu ON pu.id = psl.parent_id
       WHERE psl.student_id = $1 AND pu.school_id = $2`,
      [req.params.id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/parent-links -
router.post('/:id/parent-links', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { mobile, name } = req.body;
    if (!mobile) return res.status(400).json({ error: 'mobile is required' });
    const studentRow = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    let parentRow = await pool.query(
      'SELECT id FROM parent_users WHERE mobile = $1 AND school_id = $2',
      [mobile, school_id]
    );
    if (parentRow.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(mobile, 12);
      parentRow = await pool.query(
        `INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [school_id, mobile, name || null, hash]
      );
    }
    await pool.query(
      `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [parentRow.rows[0].id, req.params.id]
    );
    return res.status(201).json({ parent_id: parentRow.rows[0].id, message: 'Parent linked successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - DELETE /api/v1/admin/students/:id/parent-links/:parent_id -
router.delete('/:id/parent-links/:parent_id', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM parent_student_links WHERE student_id = $1 AND parent_id = $2',
      [req.params.id, req.params.parent_id]
    );
    return res.json({ message: 'Parent unlinked' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - PUT /api/v1/admin/students/:id ? update parent/guardian details -
router.put('/:id', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { father_name, mother_name, parent_contact, mother_contact } = req.body;
    if (parent_contact && mother_contact && parent_contact.trim() === mother_contact.trim()) {
      return res.status(400).json({ error: 'Father and mother cannot have the same mobile number' });
    }
    if (parent_contact && !/^\d{10}$/.test(parent_contact.trim())) {
      return res.status(400).json({ error: 'Father mobile must be 10 digits' });
    }
    if (mother_contact && !/^\d{10}$/.test(mother_contact.trim())) {
      return res.status(400).json({ error: 'Mother mobile must be 10 digits' });
    }
    const result = await pool.query(
      `UPDATE students SET
         father_name = COALESCE($1, father_name),
         mother_name = COALESCE($2, mother_name),
         parent_contact = COALESCE($3, parent_contact),
         mother_contact = COALESCE($4, mother_contact)
       WHERE id = $5 AND school_id = $6
       RETURNING id, name, father_name, mother_name, parent_contact, mother_contact`,
      [father_name || null, mother_name || null, parent_contact || null, mother_contact || null, req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/terminate — soft-delete a student -
router.post('/:id/terminate', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id, user_id } = req.user!;
    const studentId = req.params.id;

    // Fetch student details before terminating (needed for history)
    const studentRow = await client.query(
      `SELECT s.id, s.name, s.class_id, s.section_id,
              c.name AS class_name, sec.label AS section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1 AND s.school_id = $2 AND s.is_active = true`,
      [studentId, school_id]
    );
    if (studentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or already terminated' });
    }
    const student = studentRow.rows[0];

    await client.query('BEGIN');

    // 1. Soft-terminate the student
    await client.query(
      `UPDATE students
       SET is_active = false, terminated_at = now(), terminated_by = $1
       WHERE id = $2 AND school_id = $3`,
      [user_id, studentId, school_id]
    );

    // 2. Save academic history record
    // Determine current academic year from school settings (fall back to current calendar year)
    const ayRow = await client.query(
      `SELECT label FROM academic_years
       WHERE school_id = $1 AND is_current = true LIMIT 1`,
      [school_id]
    );
    const academicYear = ayRow.rows[0]?.label ||
      `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;

    await client.query(
      `INSERT INTO student_academic_history
         (school_id, student_id, academic_year, class_id, section_id,
          class_name, section_label, outcome, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'terminated',$8)
       ON CONFLICT (student_id, academic_year)
       DO UPDATE SET outcome = 'terminated', created_by = EXCLUDED.created_by`,
      [school_id, studentId, academicYear,
       student.class_id, student.section_id,
       student.class_name, student.section_label, user_id]
    );

    // 3. Mark outstanding fee accounts as status='terminated'
    //    Preserves payment history but flags the account so it's excluded from
    //    active collection reports. Outstanding balance is kept for audit purposes.
    await client.query(
      `UPDATE student_fee_accounts
       SET status = 'terminated', updated_at = now()
       WHERE student_id = $1 AND school_id = $2
         AND deleted_at IS NULL AND status != 'paid'`,
      [studentId, school_id]
    );

    // 4. Cancel any pending fee reminders for this student
    await client.query(
      `UPDATE fee_reminders
       SET status = 'cancelled'
       WHERE student_id = $1 AND school_id = $2 AND status = 'pending'`,
      [studentId, school_id]
    ).catch(() => { /* fee_reminders table may not exist in all deployments */ });

    // 5. Abandon any in-progress quiz attempts
    await client.query(
      `UPDATE quiz_attempts
       SET status = 'abandoned'
       WHERE student_id = $1 AND school_id = $2 AND status = 'in_progress'`,
      [studentId, school_id]
    ).catch(() => { /* ignore if table doesn't exist */ });

    // 6. Delete student portal account
    await client.query(
      'DELETE FROM student_accounts WHERE student_id = $1 AND school_id = $2',
      [studentId, school_id]
    );

    // 7. Deactivate parent accounts linked ONLY to this student
    //    (parents with other active children keep their accounts)
    const orphaned = await client.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       WHERE psl.student_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM parent_student_links psl2
           JOIN students s2 ON s2.id = psl2.student_id
           WHERE psl2.parent_id = psl.parent_id
             AND psl2.student_id != $1
             AND s2.is_active = true
         )`,
      [studentId]
    );

    let parentsDeactivated = 0;
    if (orphaned.rows.length > 0) {
      const parentIds = orphaned.rows.map((r: any) => r.parent_id);
      await client.query(
        'UPDATE parent_users SET is_active = false WHERE id = ANY($1::uuid[]) AND school_id = $2',
        [parentIds, school_id]
      );
      parentsDeactivated = parentIds.length;
    }

    await client.query('COMMIT');
    return res.json({
      message: 'Student terminated',
      student_name: student.name,
      parents_deactivated: parentsDeactivated,
      academic_year: academicYear,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[terminate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// - POST /api/v1/admin/students/:id/reactivate — restore a terminated student -
router.post('/:id/reactivate', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const studentId = req.params.id;

    await client.query('BEGIN');

    // 1. Reactivate the student
    const result = await client.query(
      `UPDATE students
       SET is_active = true, terminated_at = null, terminated_by = null
       WHERE id = $1 AND school_id = $2
       RETURNING name`,
      [studentId, school_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }

    // 2. Restore fee accounts from 'terminated' back to 'active'
    //    (only those that weren't already paid)
    await client.query(
      `UPDATE student_fee_accounts
       SET status = 'active', updated_at = now()
       WHERE student_id = $1 AND school_id = $2
         AND deleted_at IS NULL AND status = 'terminated'`,
      [studentId, school_id]
    );

    // 3. Reactivate parent accounts that were deactivated because of this student
    //    (any parent linked to this student who is currently inactive)
    const linkedParents = await client.query(
      `SELECT psl.parent_id
       FROM parent_student_links psl
       JOIN parent_users pu ON pu.id = psl.parent_id
       WHERE psl.student_id = $1 AND pu.school_id = $2 AND pu.is_active = false`,
      [studentId, school_id]
    );
    let parentsReactivated = 0;
    if (linkedParents.rows.length > 0) {
      const parentIds = linkedParents.rows.map((r: any) => r.parent_id);
      await client.query(
        'UPDATE parent_users SET is_active = true WHERE id = ANY($1::uuid[]) AND school_id = $2',
        [parentIds, school_id]
      );
      parentsReactivated = parentIds.length;
    }

    await client.query('COMMIT');
    return res.json({
      message: 'Student reactivated',
      student_name: result.rows[0].name,
      parents_reactivated: parentsReactivated,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[reactivate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

//  Academic Year Management 

// GET /api/v1/admin/students/academic-years
router.get('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/students/academic-years
router.post('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const { label, start_date, end_date, set_current } = req.body as {
      label: string; start_date: string; end_date: string; set_current?: boolean;
    };
    if (!label || !start_date || !end_date) {
      return res.status(400).json({ error: 'label, start_date, and end_date are required' });
    }
    await client.query('BEGIN');
    if (set_current) {
      await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    }
    const result = await client.query(
      `INSERT INTO academic_years (school_id, label, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, label) DO UPDATE
         SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, is_current = EXCLUDED.is_current
       RETURNING *`,
      [school_id, label, start_date, end_date, set_current ?? false]
    );
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/admin/students/academic-years/:id/set-current
router.put('/academic-years/:id/set-current', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    await client.query('BEGIN');
    await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    const result = await client.query(
      'UPDATE academic_years SET is_current = true WHERE id = $1 AND school_id = $2 RETURNING *',
      [req.params.id, school_id]
    );
    if (result.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Academic year not found' }); }
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// --- Student Academic History -------------------------------------------------

// GET /api/v1/admin/students/:id/history
router.get('/:id/history', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT h.*, c.name as class_name, sec.label as section_label,
              pc.name as promoted_to_class_name, ps.label as promoted_to_section_label
       FROM student_academic_history h
       JOIN classes c ON c.id = h.class_id
       JOIN sections sec ON sec.id = h.section_id
       LEFT JOIN classes pc ON pc.id = h.promoted_to_class_id
       LEFT JOIN sections ps ON ps.id = h.promoted_to_section_id
       WHERE h.student_id = $1 AND h.school_id = $2
       ORDER BY h.academic_year DESC`,
      [req.params.id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

//  Change Student Class 

// PUT /api/v1/admin/students/:id/change-class
router.put('/:id/change-class', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id } = req.body as { class_id: string; section_id: string };
    if (!class_id || !section_id) {
      return res.status(400).json({ error: 'class_id and section_id are required' });
    }
    const secRow = await pool.query(
      `SELECT sec.id, sec.label, c.name as class_name
       FROM sections sec JOIN classes c ON c.id = sec.class_id
       WHERE sec.id = $1 AND sec.class_id = $2 AND sec.school_id = $3`,
      [section_id, class_id, school_id]
    );
    if (secRow.rows.length === 0) {
      return res.status(400).json({ error: 'Section not found in the specified class' });
    }
    const result = await pool.query(
      `UPDATE students SET class_id = $1, section_id = $2
       WHERE id = $3 AND school_id = $4
       RETURNING id, name, class_id, section_id`,
      [class_id, section_id, req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json({
      ...result.rows[0],
      class_name: secRow.rows[0].class_name,
      section_label: secRow.rows[0].label,
      message: 'Class updated successfully',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Bulk Change Section --------------------------------------------------

// POST /api/v1/admin/students/bulk-change-section
// Moves all selected students to a new class + section in one shot.
router.post('/bulk-change-section', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const { student_ids, class_id, section_id } = req.body as {
      student_ids: string[];
      class_id: string;
      section_id: string;
    };

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'student_ids array is required' });
    }
    if (!class_id || !section_id) {
      return res.status(400).json({ error: 'class_id and section_id are required' });
    }

    // Verify the section belongs to the class and this school
    const secRow = await client.query(
      `SELECT sec.id, sec.label, c.name AS class_name
       FROM sections sec JOIN classes c ON c.id = sec.class_id
       WHERE sec.id = $1 AND sec.class_id = $2 AND sec.school_id = $3`,
      [section_id, class_id, school_id]
    );
    if (secRow.rows.length === 0) {
      return res.status(400).json({ error: 'Section not found in the specified class' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE students
       SET class_id = $1, section_id = $2
       WHERE id = ANY($3::uuid[]) AND school_id = $4 AND is_active = true
       RETURNING id, name`,
      [class_id, section_id, student_ids, school_id]
    );

    await client.query('COMMIT');

    return res.json({
      updated: result.rows.length,
      class_name: secRow.rows[0].class_name,
      section_label: secRow.rows[0].label,
      students: result.rows.map((r: any) => r.name),
      message: `${result.rows.length} student(s) moved to ${secRow.rows[0].class_name} Section ${secRow.rows[0].label}`,
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bulk-change-section]', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  } finally {
    client.release();
  }
});

//  Bulk Promote 

// POST /api/v1/admin/students/bulk-promote
router.post('/bulk-promote', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id, user_id } = req.user!;
    const { promotions, from_academic_year, to_academic_year } = req.body as {
      promotions: Array<{
        student_id: string;
        to_class_id: string;
        to_section_id: string;
        outcome: 'promoted' | 'repeated';
      }>;
      from_academic_year: string;
      to_academic_year: string;
    };

    if (!Array.isArray(promotions) || promotions.length === 0) {
      return res.status(400).json({ error: 'promotions array is required' });
    }
    if (!from_academic_year || !to_academic_year) {
      return res.status(400).json({ error: 'from_academic_year and to_academic_year are required' });
    }

    await client.query('BEGIN');
    const results: { student_id: string; name: string; status: string }[] = [];

    for (const p of promotions) {
      try {
        const studentRow = await client.query(
          `SELECT s.id, s.name, s.class_id, s.section_id,
                  c.name as class_name, sec.label as section_label
           FROM students s
           JOIN classes c ON c.id = s.class_id
           JOIN sections sec ON sec.id = s.section_id
           WHERE s.id = $1 AND s.school_id = $2 AND s.is_active = true`,
          [p.student_id, school_id]
        );
        if (studentRow.rows.length === 0) {
          results.push({ student_id: p.student_id, name: '?', status: 'skipped: not found or inactive' });
          continue;
        }
        const student = studentRow.rows[0];

        // Snapshot attendance
        const attRow = await client.query(
          `SELECT COUNT(*) FILTER (WHERE status='present')::int as present, COUNT(*)::int as total
           FROM attendance_records WHERE student_id = $1`,
          [p.student_id]
        );
        const att = attRow.rows[0];
        const att_pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

        // Snapshot curriculum coverage
        const covRow = await client.query(
          `SELECT COUNT(DISTINCT cc.id)::int as total,
                  COUNT(DISTINCT dc_chunks.chunk_id)::int as covered
           FROM curriculum_documents cd
           JOIN curriculum_chunks cc ON cc.document_id = cd.id
           LEFT JOIN (
             SELECT unnest(covered_chunk_ids) as chunk_id
             FROM daily_completions WHERE section_id = $1
           ) dc_chunks ON dc_chunks.chunk_id = cc.id
           WHERE cd.class_id = $2 AND cd.school_id = $3`,
          [student.section_id, student.class_id, school_id]
        );
        const cov = covRow.rows[0];

        // Save history
        await client.query(
          `INSERT INTO student_academic_history
             (school_id, student_id, academic_year, class_id, section_id,
              class_name, section_label, outcome,
              attendance_pct, topics_covered, total_topics,
              promoted_to_class_id, promoted_to_section_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (student_id, academic_year) DO UPDATE
             SET outcome = EXCLUDED.outcome,
                 promoted_to_class_id = EXCLUDED.promoted_to_class_id,
                 promoted_to_section_id = EXCLUDED.promoted_to_section_id,
                 attendance_pct = EXCLUDED.attendance_pct,
                 topics_covered = EXCLUDED.topics_covered,
                 total_topics = EXCLUDED.total_topics`,
          [
            school_id, p.student_id, from_academic_year,
            student.class_id, student.section_id,
            student.class_name, student.section_label,
            p.outcome, att_pct, cov.covered, cov.total,
            p.to_class_id, p.to_section_id, user_id,
          ]
        );

        // Move student to new class/section
        await client.query(
          `UPDATE students SET class_id = $1, section_id = $2, academic_year = $3
           WHERE id = $4 AND school_id = $5`,
          [p.to_class_id, p.to_section_id, to_academic_year, p.student_id, school_id]
        );

        results.push({ student_id: p.student_id, name: student.name, status: 'promoted' });
      } catch (innerErr) {
        console.error(`[bulk-promote] student ${p.student_id}:`, innerErr);
        results.push({ student_id: p.student_id, name: '?', status: 'error' });
      }
    }

    await client.query('COMMIT');
    return res.json({
      promoted: results.filter(r => r.status === 'promoted').length,
      skipped: results.filter(r => r.status !== 'promoted').length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-promote]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

//  Bulk Terminate 

// POST /api/v1/admin/students/bulk-terminate
router.post('/bulk-terminate', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id, user_id } = req.user!;
    const { student_ids, academic_year } = req.body as {
      student_ids: string[];
      academic_year?: string;
    };

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'student_ids array is required' });
    }

    await client.query('BEGIN');

    // 1. Soft-terminate students
    await client.query(
      `UPDATE students SET is_active = false, terminated_at = now(), terminated_by = $1
       WHERE id = ANY($2::uuid[]) AND school_id = $3`,
      [user_id, student_ids, school_id]
    );

    // 2. Save history rows
    if (academic_year) {
      for (const sid of student_ids) {
        const sRow = await client.query(
          `SELECT s.class_id, s.section_id, c.name as class_name, sec.label as section_label
           FROM students s
           JOIN classes c ON c.id = s.class_id
           JOIN sections sec ON sec.id = s.section_id
           WHERE s.id = $1 AND s.school_id = $2`,
          [sid, school_id]
        );
        if (sRow.rows.length === 0) continue;
        const s = sRow.rows[0];
        await client.query(
          `INSERT INTO student_academic_history
             (school_id, student_id, academic_year, class_id, section_id,
              class_name, section_label, outcome, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'terminated',$8)
           ON CONFLICT (student_id, academic_year) DO UPDATE SET outcome = 'terminated'`,
          [school_id, sid, academic_year, s.class_id, s.section_id, s.class_name, s.section_label, user_id]
        );
      }
    }

    // 3. Delete student portal accounts
    await client.query(
      'DELETE FROM student_accounts WHERE student_id = ANY($1::uuid[]) AND school_id = $2',
      [student_ids, school_id]
    );

    // 4. Mark outstanding fee accounts as 'terminated'
    await client.query(
      `UPDATE student_fee_accounts
       SET status = 'terminated', updated_at = now()
       WHERE student_id = ANY($1::uuid[]) AND school_id = $2
         AND deleted_at IS NULL AND status != 'paid'`,
      [student_ids, school_id]
    );

    // 5. Cancel pending fee reminders
    await client.query(
      `UPDATE fee_reminders SET status = 'cancelled'
       WHERE student_id = ANY($1::uuid[]) AND school_id = $2 AND status = 'pending'`,
      [student_ids, school_id]
    ).catch(() => {});

    // 6. Abandon in-progress quiz attempts
    await client.query(
      `UPDATE quiz_attempts SET status = 'abandoned'
       WHERE student_id = ANY($1::uuid[]) AND school_id = $2 AND status = 'in_progress'`,
      [student_ids, school_id]
    ).catch(() => {});

    // 7. Deactivate orphaned parents (linked only to terminated students)
    const orphaned = await client.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       WHERE psl.student_id = ANY($1::uuid[])
         AND NOT EXISTS (
           SELECT 1 FROM parent_student_links psl2
           JOIN students s2 ON s2.id = psl2.student_id
           WHERE psl2.parent_id = psl.parent_id
             AND s2.is_active = true
             AND NOT (psl2.student_id = ANY($1::uuid[]))
         )`,
      [student_ids]
    );

    let parentsDeactivated = 0;
    if (orphaned.rows.length > 0) {
      const parentIds = orphaned.rows.map((r: any) => r.parent_id);
      await client.query(
        'UPDATE parent_users SET is_active = false WHERE id = ANY($1::uuid[]) AND school_id = $2',
        [parentIds, school_id]
      );
      parentsDeactivated = parentIds.length;
    }

    await client.query('COMMIT');
    return res.json({
      terminated: student_ids.length,
      parents_deactivated: parentsDeactivated,
      message: `${student_ids.length} student(s) terminated. ${parentsDeactivated} parent account(s) deactivated.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-terminate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// --- Academic Year Management ---

// GET /api/v1/admin/students/academic-years
router.get('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/students/academic-years
router.post('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const { label, start_date, end_date, set_current } = req.body;
    if (!label || !start_date || !end_date) return res.status(400).json({ error: 'label, start_date, and end_date are required' });
    await client.query('BEGIN');
    if (set_current) await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    const result = await client.query(
      `INSERT INTO academic_years (school_id, label, start_date, end_date, is_current) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (school_id, label) DO UPDATE SET start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, is_current=EXCLUDED.is_current RETURNING *`,
      [school_id, label, start_date, end_date, set_current ?? false]
    );
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'Internal server error' }); }
  finally { client.release(); }
});

// PUT /api/v1/admin/students/academic-years/:id/set-current
router.put('/academic-years/:id/set-current', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    await client.query('BEGIN');
    await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    const r = await client.query('UPDATE academic_years SET is_current = true WHERE id = $1 AND school_id = $2 RETURNING *', [req.params.id, school_id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('COMMIT');
    return res.json(r.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'Internal server error' }); }
  finally { client.release(); }
});


// --- Academic Year Management -------------------------------------------------

// GET /api/v1/admin/students/academic-years
router.get('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/students/academic-years
router.post('/academic-years', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    const { label, start_date, end_date, set_current } = req.body as {
      label: string; start_date: string; end_date: string; set_current?: boolean;
    };
    if (!label || !start_date || !end_date) {
      return res.status(400).json({ error: 'label, start_date, and end_date are required' });
    }
    await client.query('BEGIN');
    if (set_current) {
      await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    }
    const result = await client.query(
      `INSERT INTO academic_years (school_id, label, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, label) DO UPDATE
         SET start_date = EXCLUDED.start_date,
             end_date   = EXCLUDED.end_date,
             is_current = EXCLUDED.is_current
       RETURNING *`,
      [school_id, label, start_date, end_date, set_current ?? false]
    );
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/admin/students/academic-years/:id/set-current
router.put('/academic-years/:id/set-current', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id } = req.user!;
    await client.query('BEGIN');
    await client.query('UPDATE academic_years SET is_current = false WHERE school_id = $1', [school_id]);
    const result = await client.query(
      'UPDATE academic_years SET is_current = true WHERE id = $1 AND school_id = $2 RETURNING *',
      [req.params.id, school_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Academic year not found' });
    }
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// --- Student Academic History -------------------------------------------------

// GET /api/v1/admin/students/:id/history
router.get('/:id/history', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT h.*,
              c.name  as class_name,       sec.label as section_label,
              pc.name as promoted_to_class_name, ps.label as promoted_to_section_label
       FROM student_academic_history h
       JOIN classes  c   ON c.id   = h.class_id
       JOIN sections sec ON sec.id = h.section_id
       LEFT JOIN classes  pc ON pc.id  = h.promoted_to_class_id
       LEFT JOIN sections ps ON ps.id  = h.promoted_to_section_id
       WHERE h.student_id = $1 AND h.school_id = $2
       ORDER BY h.academic_year DESC`,
      [req.params.id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Change Student Class (post-promotion edit) -------------------------------

// PUT /api/v1/admin/students/:id/change-class
router.put('/:id/change-class', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id } = req.body as { class_id: string; section_id: string };
    if (!class_id || !section_id) {
      return res.status(400).json({ error: 'class_id and section_id are required' });
    }
    const secRow = await pool.query(
      `SELECT sec.id, sec.label, c.name as class_name
       FROM sections sec JOIN classes c ON c.id = sec.class_id
       WHERE sec.id = $1 AND sec.class_id = $2 AND sec.school_id = $3`,
      [section_id, class_id, school_id]
    );
    if (secRow.rows.length === 0) {
      return res.status(400).json({ error: 'Section not found in the specified class' });
    }
    const result = await pool.query(
      `UPDATE students SET class_id = $1, section_id = $2
       WHERE id = $3 AND school_id = $4
       RETURNING id, name, class_id, section_id`,
      [class_id, section_id, req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json({
      ...result.rows[0],
      class_name: secRow.rows[0].class_name,
      section_label: secRow.rows[0].label,
      message: 'Class updated successfully',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Bulk Promote -------------------------------------------------------------

// POST /api/v1/admin/students/bulk-promote
router.post('/bulk-promote', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id, user_id } = req.user!;
    const { promotions, from_academic_year, to_academic_year } = req.body as {
      promotions: Array<{
        student_id: string;
        to_class_id: string;
        to_section_id: string;
        outcome: 'promoted' | 'repeated';
      }>;
      from_academic_year: string;
      to_academic_year: string;
    };

    if (!Array.isArray(promotions) || promotions.length === 0) {
      return res.status(400).json({ error: 'promotions array is required' });
    }
    if (!from_academic_year || !to_academic_year) {
      return res.status(400).json({ error: 'from_academic_year and to_academic_year are required' });
    }

    await client.query('BEGIN');
    const results: { student_id: string; name: string; status: string }[] = [];

    for (const p of promotions) {
      try {
        const studentRow = await client.query(
          `SELECT s.id, s.name, s.class_id, s.section_id,
                  c.name as class_name, sec.label as section_label
           FROM students s
           JOIN classes c ON c.id = s.class_id
           JOIN sections sec ON sec.id = s.section_id
           WHERE s.id = $1 AND s.school_id = $2 AND s.is_active = true`,
          [p.student_id, school_id]
        );
        if (studentRow.rows.length === 0) {
          results.push({ student_id: p.student_id, name: '?', status: 'skipped: not found or inactive' });
          continue;
        }
        const student = studentRow.rows[0];

        // Snapshot attendance %
        const attRow = await client.query(
          `SELECT COUNT(*) FILTER (WHERE status='present')::int as present,
                  COUNT(*)::int as total
           FROM attendance_records WHERE student_id = $1`,
          [p.student_id]
        );
        const att = attRow.rows[0];
        const att_pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

        // Snapshot curriculum coverage
        const covRow = await client.query(
          `SELECT COUNT(DISTINCT cc.id)::int as total,
                  COUNT(DISTINCT dc_chunks.chunk_id)::int as covered
           FROM curriculum_documents cd
           JOIN curriculum_chunks cc ON cc.document_id = cd.id
           LEFT JOIN (
             SELECT unnest(covered_chunk_ids) as chunk_id
             FROM daily_completions WHERE section_id = $1
           ) dc_chunks ON dc_chunks.chunk_id = cc.id
           WHERE cd.class_id = $2 AND cd.school_id = $3`,
          [student.section_id, student.class_id, school_id]
        );
        const cov = covRow.rows[0];

        // Save history row (upsert)
        await client.query(
          `INSERT INTO student_academic_history
             (school_id, student_id, academic_year, class_id, section_id,
              class_name, section_label, outcome,
              attendance_pct, topics_covered, total_topics,
              promoted_to_class_id, promoted_to_section_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (student_id, academic_year) DO UPDATE
             SET outcome                = EXCLUDED.outcome,
                 promoted_to_class_id   = EXCLUDED.promoted_to_class_id,
                 promoted_to_section_id = EXCLUDED.promoted_to_section_id,
                 attendance_pct         = EXCLUDED.attendance_pct,
                 topics_covered         = EXCLUDED.topics_covered,
                 total_topics           = EXCLUDED.total_topics`,
          [
            school_id, p.student_id, from_academic_year,
            student.class_id, student.section_id,
            student.class_name, student.section_label,
            p.outcome, att_pct, cov.covered, cov.total,
            p.to_class_id, p.to_section_id, user_id,
          ]
        );

        // Move student to new class/section and update academic year
        await client.query(
          `UPDATE students SET class_id = $1, section_id = $2, academic_year = $3
           WHERE id = $4 AND school_id = $5`,
          [p.to_class_id, p.to_section_id, to_academic_year, p.student_id, school_id]
        );

        results.push({ student_id: p.student_id, name: student.name, status: 'promoted' });
      } catch (innerErr) {
        console.error(`[bulk-promote] student ${p.student_id}:`, innerErr);
        results.push({ student_id: p.student_id, name: '?', status: 'error' });
      }
    }

    await client.query('COMMIT');
    return res.json({
      promoted: results.filter(r => r.status === 'promoted').length,
      skipped:  results.filter(r => r.status !== 'promoted').length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-promote]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// --- Bulk Terminate -----------------------------------------------------------

// POST /api/v1/admin/students/bulk-terminate
router.post('/bulk-terminate', roleGuard('admin'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { school_id, user_id } = req.user!;
    const { student_ids, academic_year } = req.body as {
      student_ids: string[];
      academic_year?: string;
    };

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'student_ids array is required' });
    }

    await client.query('BEGIN');

    // 1. Soft-terminate students
    await client.query(
      `UPDATE students
       SET is_active = false, terminated_at = now(), terminated_by = $1
       WHERE id = ANY($2::uuid[]) AND school_id = $3`,
      [user_id, student_ids, school_id]
    );

    // 2. Save history rows
    if (academic_year) {
      for (const sid of student_ids) {
        const sRow = await client.query(
          `SELECT s.class_id, s.section_id, c.name as class_name, sec.label as section_label
           FROM students s
           JOIN classes c ON c.id = s.class_id
           JOIN sections sec ON sec.id = s.section_id
           WHERE s.id = $1 AND s.school_id = $2`,
          [sid, school_id]
        );
        if (sRow.rows.length === 0) continue;
        const s = sRow.rows[0];
        await client.query(
          `INSERT INTO student_academic_history
             (school_id, student_id, academic_year, class_id, section_id,
              class_name, section_label, outcome, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'terminated',$8)
           ON CONFLICT (student_id, academic_year) DO UPDATE SET outcome = 'terminated'`,
          [school_id, sid, academic_year, s.class_id, s.section_id, s.class_name, s.section_label, user_id]
        );
      }
    }

    // 3. Delete student portal accounts
    await client.query(
      'DELETE FROM student_accounts WHERE student_id = ANY($1::uuid[]) AND school_id = $2',
      [student_ids, school_id]
    );

    // 4. Deactivate orphaned parents (linked only to terminated students)
    const orphaned = await client.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       WHERE psl.student_id = ANY($1::uuid[])
         AND NOT EXISTS (
           SELECT 1 FROM parent_student_links psl2
           JOIN students s2 ON s2.id = psl2.student_id
           WHERE psl2.parent_id = psl.parent_id
             AND s2.is_active = true
             AND NOT (psl2.student_id = ANY($1::uuid[]))
         )`,
      [student_ids]
    );

    let parentsDeactivated = 0;
    if (orphaned.rows.length > 0) {
      const parentIds = orphaned.rows.map((r: any) => r.parent_id);
      await client.query(
        'UPDATE parent_users SET is_active = false WHERE id = ANY($1::uuid[]) AND school_id = $2',
        [parentIds, school_id]
      );
      parentsDeactivated = parentIds.length;
    }

    await client.query('COMMIT');
    return res.json({
      terminated: student_ids.length,
      parents_deactivated: parentsDeactivated,
      message: `${student_ids.length} student(s) terminated. ${parentsDeactivated} parent account(s) deactivated.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-terminate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/v1/admin/students/login-cards?class_id=&section_id=
// Generates a PDF of parent login cards for printing
router.get('/login-cards', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id } = req.query as Record<string, string>;

    // Get school info
    const schoolRow = await pool.query('SELECT name, subdomain FROM schools WHERE id = $1', [school_id]);
    const school = schoolRow.rows[0] || { name: 'School', subdomain: '' };
    const APP_URL = 'oakit.silveroakjuniors.in';

    // Build query - get ALL students with contact numbers (not just those with activated parent logins)
    let query = `
      SELECT s.name AS student_name, c.name AS class_name, sec.label AS section_label,
             s.father_name, s.mother_name, s.parent_contact, s.mother_contact
      FROM students s
      JOIN sections sec ON sec.id = s.section_id
      JOIN classes c ON c.id = sec.class_id
      WHERE s.is_active = true AND s.school_id = $1
        AND ((s.parent_contact IS NOT NULL AND s.parent_contact != '')
             OR (s.mother_contact IS NOT NULL AND s.mother_contact != ''))
    `;
    const params: any[] = [school_id];
    if (section_id) { params.push(section_id); query += ` AND s.section_id = $${params.length}`; }
    else if (class_id) { params.push(class_id); query += ` AND sec.class_id = $${params.length}`; }
    query += ' ORDER BY c.name, sec.label, s.name';

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No students with contact numbers found for the selected class/section' });

    // Build student cards with parent info from student record
    const students = result.rows.map((row: any) => {
      const parents: { name: string; mobile: string }[] = [];
      if (row.parent_contact) {
        parents.push({ name: row.father_name || 'Father', mobile: row.parent_contact });
      }
      if (row.mother_contact) {
        parents.push({ name: row.mother_name || 'Mother', mobile: row.mother_contact });
      }
      return { ...row, parents };
    });

    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const CARD_W = 241, CARD_H = 156, PAGE_MARGIN = 30, M = 8;

    let cardIdx = 0;
    const cardsPerPage = 8; // 2x4

    for (const student of students) {
      if (cardIdx > 0 && cardIdx % cardsPerPage === 0) doc.addPage();
      const pos = cardIdx % cardsPerPage;
      const col = pos % 2;
      const row = Math.floor(pos / 2);
      const x = PAGE_MARGIN + col * (CARD_W + 10);
      const y = PAGE_MARGIN + row * (CARD_H + 10);

      // Card border
      doc.roundedRect(x, y, CARD_W, CARD_H, 6).lineWidth(0.5).stroke('#d1d5db');
      // Header with logo - "oakit" white, ".ai" dark yellow
      doc.rect(x, y, CARD_W, 24).fill('#1B4332');
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold').text('oakit', x + M, y + 5, { continued: true });
      doc.fillColor('#E8960C').text('.ai');
      doc.fillColor('#86efac').fontSize(5.5).font('Helvetica').text(school.name, x + M, y + 15);
      doc.fillColor('#86efac').fontSize(5).font('Helvetica-Bold').text('Oakie - Your AI Mentor', x + CARD_W - 85, y + 9, { width: 77, align: 'right' });

      // Student name - centered
      let ty = y + 32;
      doc.fillColor('#1B4332').fontSize(11).font('Helvetica-Bold').text(student.student_name, x + M, ty, { width: CARD_W - M * 2, align: 'center' });
      ty += 14;
      doc.fillColor('#6b7280').fontSize(7).font('Helvetica').text(`${student.class_name} - Section ${student.section_label}`, x + M, ty, { width: CARD_W - M * 2, align: 'center' });
      ty += 14;
      doc.moveTo(x + M + 20, ty).lineTo(x + CARD_W - M - 20, ty).lineWidth(0.3).stroke('#e5e7eb');
      ty += 8;

      // Login details
      doc.fillColor('#374151').fontSize(6).font('Helvetica-Bold').text('PARENT LOGIN', x + M, ty);
      ty += 10;

      for (const p of student.parents) {
        doc.fillColor('#111827').fontSize(7).font('Helvetica-Bold').text(p.name, x + M, ty);
        ty += 9;
        doc.fillColor('#1B4332').fontSize(7).font('Helvetica').text(`Mobile: ${p.mobile}  |  Password: ${p.mobile}`, x + M, ty);
        ty += 11;
      }

      // Footer
      doc.rect(x, y + CARD_H - 16, CARD_W, 16).fill('#f0fdf4');
      doc.fillColor('#1B4332').fontSize(6.5).font('Helvetica-Bold').text(APP_URL, x + M, y + CARD_H - 12);
      doc.fillColor('#6b7280').fontSize(5.5).font('Helvetica').text(`Code: ${school.subdomain}`, x + CARD_W - 60, y + CARD_H - 12, { width: 52, align: 'right' });
      // Oakie mascot - skip in API (image may not be available)
      cardIdx++;
    }

    // Back pages with instructions
    const totalPages = Math.ceil(students.length / cardsPerPage);
    for (let p = 0; p < totalPages; p++) {
      doc.addPage();
      for (let i = 0; i < cardsPerPage; i++) {
        const col = 1 - (i % 2); // mirror for double-sided
        const row = Math.floor(i / 2);
        const x = PAGE_MARGIN + col * (CARD_W + 10);
        const y = PAGE_MARGIN + row * (CARD_H + 10);

        doc.roundedRect(x, y, CARD_W, CARD_H, 6).lineWidth(0.5).stroke('#d1d5db');
        // School logo - skip in API (image may not be available)
        let ty = y + M + 10;

        // Branding
        doc.fillColor('#1B4332').fontSize(9).font('Helvetica-Bold').text(school.name, x + M, ty, { width: CARD_W - M * 2, align: 'center' });
        ty += 11;
        doc.fillColor('#6b7280').fontSize(6).font('Helvetica').text('AI-Integrated Preschool', x + M, ty, { width: CARD_W - M * 2, align: 'center' });
        ty += 10;
        doc.moveTo(x + M + 30, ty).lineTo(x + CARD_W - M - 30, ty).lineWidth(0.3).stroke('#e5e7eb');
        ty += 6;
        // Quick start
        doc.fillColor('#1B4332').fontSize(6).font('Helvetica-Bold').text('Quick Start', x + M, ty);
        ty += 9;
        const steps = [`1. Open Chrome/Safari > ${APP_URL}`, `2. School Code: ${school.subdomain}`, '3. Enter Mobile & Password > Login'];
        doc.fillColor('#374151').fontSize(5.5).font('Helvetica');
        for (const s of steps) { doc.text(s, x + M, ty, { width: CARD_W - M * 2 }); ty += 7; }
        ty += 3;
        doc.fillColor('#374151').fontSize(5).font('Helvetica');
        doc.text('Android: Menu > Add to Home screen', x + M, ty); ty += 6;
        doc.text('iPhone: Share > Add to Home Screen', x + M, ty);
        // Footer
        doc.rect(x, y + CARD_H - 12, CARD_W, 12).fill('#1B4332');
        doc.fillColor('#86efac').fontSize(4.5).font('Helvetica-Bold').text('Powered by oakit.ai - Where AI meets Early Education', x + M, y + CARD_H - 9, { width: CARD_W - M * 2, align: 'center' });
      }
    }

    doc.end();
    await new Promise<void>(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="login-cards-${section_id || class_id || 'all'}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[login-cards]', err);
    return res.status(500).json({ error: 'Failed to generate login cards' });
  }
});

export default router;
