/**
 * students/crud.ts — Core student CRUD routes
 * POST   /                  create student
 * GET    /                  list students
 * GET    /:id               get student
 * PUT    /:id               update student
 * POST   /:id/photo         upload photo
 * POST   /:id/terminate     soft-delete
 * POST   /:id/reactivate    restore
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../../../lib/db';
import { roleGuard } from '../../../middleware/auth';
import { uploadFile, deleteFile } from '../../../lib/storage';
import { assignFeeStructureToStudent } from '../../../lib/feeAssignment';

export const crudRouter = Router();

const photoUpload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Photo must be JPEG or PNG'));
  },
});

// POST /
crudRouter.post('/', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { name, class_id, section_id, father_name, mother_name, parent_contact, mother_contact, fee_assignment } = req.body;

    if (!name || !class_id || !section_id) return res.status(400).json({ error: 'name, class_id, and section_id are required' });
    if (parent_contact && mother_contact && parent_contact.trim() === mother_contact.trim()) return res.status(400).json({ error: 'Father and mother cannot have the same mobile number' });
    if (parent_contact && !/^\d{10}$/.test(parent_contact.trim())) return res.status(400).json({ error: 'Father mobile must be 10 digits' });
    if (mother_contact && !/^\d{10}$/.test(mother_contact.trim())) return res.status(400).json({ error: 'Mother mobile must be 10 digits' });

    const feeCheck = await pool.query(
      `SELECT fh.id FROM fee_heads fh WHERE fh.school_id = $1 AND fh.class_id = $2 AND fh.type IN ('tuition', 'admission') AND fh.deleted_at IS NULL LIMIT 1`,
      [school_id, class_id],
    );
    if (feeCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot onboard student: no tuition or annual fee has been assigned to this class. Please set up a fee structure for this class first.' });
    }

    if (fee_assignment) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const insertResult = await client.query(
          `INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name`,
          [school_id, class_id, section_id, name.trim(), father_name?.trim() || null, mother_name?.trim() || null, parent_contact?.trim() || null, mother_contact?.trim() || null],
        );
        const student = insertResult.rows[0];
        let feeAccountsCreated = 0;
        try {
          const assignResult = await assignFeeStructureToStudent({ studentId: student.id, schoolId: school_id, feeStructureId: fee_assignment.fee_structure_id, classId: class_id, client });
          feeAccountsCreated = assignResult.fee_accounts_created;
        } catch (assignErr: any) {
          await client.query('ROLLBACK');
          if (assignErr.message === "Fee structure does not match the student's class") return res.status(400).json({ error: assignErr.message });
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

    const result = await pool.query(
      `INSERT INTO students (school_id, class_id, section_id, name, father_name, mother_name, parent_contact, mother_contact) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name`,
      [school_id, class_id, section_id, name.trim(), father_name?.trim() || null, mother_name?.trim() || null, parent_contact?.trim() || null, mother_contact?.trim() || null],
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /
crudRouter.get('/', roleGuard('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, include_inactive, incomplete_parents, search } = req.query;

    let query = `SELECT s.id, s.name, s.father_name, s.mother_name, s.parent_contact, s.mother_contact,
                        s.is_active, s.photo_url, s.academic_year,
                        c.name as class_name, sec.label as section_label,
                        c.id as class_id, sec.id as section_id
                 FROM students s
                 JOIN classes c ON c.id = s.class_id
                 JOIN sections sec ON sec.id = s.section_id
                 WHERE s.school_id = $1`;
    const params: any[] = [school_id];

    if (class_id) { params.push(class_id); query += ` AND s.class_id = $${params.length}`; }
    if (section_id) { params.push(section_id); query += ` AND s.section_id = $${params.length}`; }
    if (!include_inactive || include_inactive === 'false') query += ` AND s.is_active = true`;
    if (incomplete_parents === 'true') query += ` AND (s.parent_contact IS NULL OR s.mother_contact IS NULL)`;
    if (search) { params.push(`%${search}%`); query += ` AND (s.name ILIKE $${params.length} OR s.father_name ILIKE $${params.length} OR s.mother_name ILIKE $${params.length})`; }

    query += ' ORDER BY c.name, sec.label, s.name';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
crudRouter.get('/:id', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.*, c.name as class_name, sec.label as section_label
       FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [req.params.id, school_id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
crudRouter.put('/:id', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { father_name, mother_name, parent_contact, mother_contact } = req.body;
    if (parent_contact && mother_contact && parent_contact.trim() === mother_contact.trim()) return res.status(400).json({ error: 'Father and mother cannot have the same mobile number' });
    if (parent_contact && !/^\d{10}$/.test(parent_contact.trim())) return res.status(400).json({ error: 'Father mobile must be 10 digits' });
    if (mother_contact && !/^\d{10}$/.test(mother_contact.trim())) return res.status(400).json({ error: 'Mother mobile must be 10 digits' });
    const result = await pool.query(
      `UPDATE students SET father_name = COALESCE($1, father_name), mother_name = COALESCE($2, mother_name), parent_contact = COALESCE($3, parent_contact), mother_contact = COALESCE($4, mother_contact)
       WHERE id = $5 AND school_id = $6 RETURNING id, name, father_name, mother_name, parent_contact, mother_contact`,
      [father_name || null, mother_name || null, parent_contact || null, mother_contact || null, req.params.id, school_id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/photo
crudRouter.post('/:id/photo', roleGuard('admin'), (req: Request, res: Response, next: any) => {
  photoUpload.single('photo')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    try {
      const { school_id } = req.user!;
      const studentId = req.params.id;

      const studentRow = await pool.query('SELECT photo_url FROM students WHERE id = $1 AND school_id = $2', [studentId, school_id]);
      if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

      if (studentRow.rows[0].photo_url) {
        const oldPath = studentRow.rows[0].photo_url.split('/').slice(-2).join('/');
        await deleteFile(oldPath).catch(() => {});
      }

      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const { publicUrl } = await uploadFile({
        schoolId: school_id,
        folder: 'students',
        localPath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        entityType: 'student',
        entityId: studentId,
      });

      await pool.query('UPDATE students SET photo_url = $1 WHERE id = $2 AND school_id = $3', [publicUrl, studentId, school_id]);
      return res.json({ photo_url: publicUrl });
    } catch (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// POST /:id/terminate
crudRouter.post('/:id/terminate', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const studentId = req.params.id;

    await pool.query('UPDATE students SET is_active = false WHERE id = $1 AND school_id = $2', [studentId, school_id]);
    await pool.query('DELETE FROM student_accounts WHERE student_id = $1 AND school_id = $2', [studentId, school_id]);

    const orphaned = await pool.query(
      `SELECT DISTINCT psl.parent_id FROM parent_student_links psl WHERE psl.student_id = $1
       AND NOT EXISTS (SELECT 1 FROM parent_student_links psl2 JOIN students s2 ON s2.id = psl2.student_id WHERE psl2.parent_id = psl.parent_id AND psl2.student_id != $1 AND s2.is_active = true)`,
      [studentId],
    );
    if (orphaned.rows.length > 0) {
      const parentIds = orphaned.rows.map((r: any) => r.parent_id);
      await pool.query('UPDATE parent_users SET is_active = false WHERE id = ANY($1::uuid[]) AND school_id = $2', [parentIds, school_id]);
    }

    return res.json({ message: 'Student terminated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/reactivate
crudRouter.post('/:id/reactivate', roleGuard('admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query('UPDATE students SET is_active = true WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
    return res.json({ message: 'Student reactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
