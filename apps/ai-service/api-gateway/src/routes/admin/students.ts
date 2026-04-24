import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadFile, deleteFile, getPublicUrl } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope);

// Use memory/temp storage � file goes to Supabase, not disk
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

// - POST /api/v1/admin/students � create a single student -
router.post('/', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { name, class_id, section_id, father_name, mother_name, parent_contact, mother_contact } = req.body;
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

// - GET /api/v1/admin/students -
router.get('/', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, include_inactive } = req.query;
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
    query += ' ORDER BY s.name';
    const result = await pool.query(query, params);
    return res.json(result.rows.map((r: any) => ({ ...r, photo_url: getPublicUrl(r.photo_path) })));
  } catch (err) {
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
    { header: 'parent contact number', width: 22 },
    { header: 'mother contact number', width: 22 },
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
    ws.getRow(1).eachCell((cell, colNum) => { headers[colNum - 1] = String(cell.value || ''); });

    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const n = normalise(h);
      if (n.includes('studentname') || n === 'studentname' || n === 'name') colMap.student_name = i;
      else if (n.includes('fathername') || n === 'fathername') colMap.father_name = i;
      else if (n.includes('mothername') || n === 'mothername') colMap.mother_name = i;
      else if (n === 'section') colMap.section = i;
      else if (n === 'class' || n === 'classname') colMap.class = i;
      else if (n.includes('parentcontact') || n.includes('fathercontact') || n.includes('contactnumber')) colMap.parent_contact = i;
      else if (n.includes('mothercontact')) colMap.mother_contact = i;
    });

    if (colMap.student_name === undefined) return res.status(400).json({ error: 'Column "student name" not found in file' });
    if (colMap.class === undefined) return res.status(400).json({ error: 'Column "class" not found in file' });
    if (colMap.section === undefined) return res.status(400).json({ error: 'Column "section" not found in file' });

    const rows: any[][] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const vals: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => { vals[colNum - 1] = cell.value; });
      rows.push(vals);
    });

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty or has no data rows' });

    let created = 0;
    const skipped: any[] = [];

    for (const row of rows) {
      const studentName   = String(row[colMap.student_name] || '').trim();
      const fatherName    = colMap.father_name !== undefined ? String(row[colMap.father_name] || '').trim() : '';
      const motherName    = colMap.mother_name !== undefined ? String(row[colMap.mother_name] || '').trim() : '';
      const sectionLabel  = String(row[colMap.section] || '').trim();
      const className     = String(row[colMap.class] || '').trim();
      const parentContact = colMap.parent_contact !== undefined ? String(row[colMap.parent_contact] || '').trim() : '';
      const motherContact = colMap.mother_contact !== undefined ? String(row[colMap.mother_contact] || '').trim() : '';

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
        await pool.query(
          `INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [school_id, classRow.rows[0].id, sectionRow.rows[0].id, studentName,
           fatherName || null, motherName || null, parentContact || null, motherContact || null]
        );
        created++;
      } catch (err: any) { skipped.push({ studentName, reason: err.message }); }
    }

    return res.json({ created, skipped });
  } catch (err: unknown) {
    console.error(err);
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

// - PUT /api/v1/admin/students/:id � update parent/guardian details -
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

// - POST /api/v1/admin/students/:id/terminate � soft-delete a student -
router.post('/:id/terminate', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const studentId = req.params.id;

    // 1. Deactivate the student
    await pool.query(
      'UPDATE students SET is_active = false WHERE id = $1 AND school_id = $2',
      [studentId, school_id]
    );

    // 2. Delete student portal account
    await pool.query(
      'DELETE FROM student_accounts WHERE student_id = $1 AND school_id = $2',
      [studentId, school_id]
    );

    // 3. Deactivate parent accounts linked ONLY to this student (not to any other active student)
    const orphaned = await pool.query(
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
    if (orphaned.rows.length > 0) {
      const parentIds = orphaned.rows.map((r: any) => r.parent_id);
      await pool.query(
        'UPDATE parent_users SET is_active = false WHERE id = ANY($1::uuid[]) AND school_id = $2',
        [parentIds, school_id]
      );
    }

    return res.json({ message: 'Student terminated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// - POST /api/v1/admin/students/:id/reactivate � restore a terminated student -
router.post('/:id/reactivate', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      'UPDATE students SET is_active = true WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    return res.json({ message: 'Student reactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
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

// ─── Student Academic History ─────────────────────────────────────────────────

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

    // 4. Deactivate orphaned parents
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


// ─── Academic Year Management ─────────────────────────────────────────────────

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

// ─── Student Academic History ─────────────────────────────────────────────────

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

// ─── Change Student Class (post-promotion edit) ───────────────────────────────

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

// ─── Bulk Promote ─────────────────────────────────────────────────────────────

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

// ─── Bulk Terminate ───────────────────────────────────────────────────────────

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

export default router;
