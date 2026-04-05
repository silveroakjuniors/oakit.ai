"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.forceResetGuard, auth_1.schoolScope);
const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';
const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || './uploads', 'students');
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const photoStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const photoUpload = (0, multer_1.default)({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (['image/jpeg', 'image/png'].includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error('Photo must be JPEG or PNG'));
    },
});
const xlsxUpload = (0, multer_1.default)({ dest: '/tmp/oakit-uploads/' });
// GET /api/v1/admin/students
router.get('/', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const { class_id, section_id } = req.query;
        let query = `SELECT s.id, s.name, s.father_name, s.parent_contact, s.photo_path, s.is_active,
                        c.name as class_name, sec.label as section_label
                 FROM students s
                 JOIN classes c ON s.class_id = c.id
                 JOIN sections sec ON s.section_id = sec.id
                 WHERE s.school_id = $1`;
        const params = [school_id];
        if (class_id) {
            params.push(class_id);
            query += ` AND s.class_id = $${params.length}`;
        }
        if (section_id) {
            params.push(section_id);
            query += ` AND s.section_id = $${params.length}`;
        }
        query += ' ORDER BY s.name';
        const result = await db_1.pool.query(query, params);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/students/import/template
router.get('/import/template', (0, auth_1.roleGuard)('admin'), async (_req, res) => {
    // Return a simple CSV as template (xlsx would require a library)
    const csv = 'student name,father name,section,class,parent contact number\nJohn Doe,James Doe,A,LKG,9876543210\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
    return res.send(csv);
});
// POST /api/v1/admin/students/import
router.post('/import', (0, auth_1.roleGuard)('admin'), xlsxUpload.single('file'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No file uploaded' });
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fs_1.default.createReadStream(file.path), { filename: file.originalname || 'students.xlsx' });
        let parseResult;
        try {
            const aiResp = await axios_1.default.post(`${AI()}/internal/import-students`, form, {
                headers: form.getHeaders(),
                timeout: 30000,
            });
            parseResult = aiResp.data;
        }
        finally {
            fs_1.default.unlink(file.path, () => { });
        }
        let created = 0;
        const skipped = [...parseResult.invalid_rows];
        for (const row of parseResult.valid_rows) {
            // Resolve class and section IDs
            const classRow = await db_1.pool.query('SELECT id FROM classes WHERE school_id = $1 AND LOWER(name) = LOWER($2)', [school_id, row.class]);
            if (classRow.rows.length === 0) {
                skipped.push({ row, reason: `Class '${row.class}' not found` });
                continue;
            }
            const sectionRow = await db_1.pool.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(label) = LOWER($3)', [school_id, classRow.rows[0].id, row.section]);
            if (sectionRow.rows.length === 0) {
                skipped.push({ row, reason: `Section '${row.section}' not found in class '${row.class}'` });
                continue;
            }
            try {
                await db_1.pool.query(`INSERT INTO students (school_id, class_id, section_id, name, father_name, parent_contact)
           VALUES ($1, $2, $3, $4, $5, $6)`, [school_id, classRow.rows[0].id, sectionRow.rows[0].id,
                    row.student_name, row.father_name, row.parent_contact]);
                created++;
            }
            catch (err) {
                skipped.push({ row, reason: err.message });
            }
        }
        return res.json({ created, skipped });
    }
    catch (err) {
        console.error(err);
        const msg = axios_1.default.isAxiosError(err) ? err.response?.data?.detail || err.message : 'Internal server error';
        return res.status(500).json({ error: msg });
    }
});
// GET /api/v1/admin/students/:id
router.get('/:id', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT s.*, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON s.class_id = c.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = $1 AND s.school_id = $2`, [req.params.id, school_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Student not found' });
        const student = result.rows[0];
        if (student.photo_path) {
            student.photo_url = `/uploads/students/${path_1.default.basename(student.photo_path)}`;
        }
        return res.json(student);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/admin/students/:id/photo
router.post('/:id/photo', (0, auth_1.roleGuard)('admin'), (req, res, next) => {
    photoUpload.single('photo')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Photo must be JPEG or PNG and under 5 MB' });
            }
            return res.status(400).json({ error: err.message || 'Photo must be JPEG or PNG and under 5 MB' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { school_id } = req.user;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No photo uploaded' });
        const studentRow = await db_1.pool.query('SELECT id, photo_path FROM students WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        if (studentRow.rows.length === 0) {
            fs_1.default.unlink(file.path, () => { });
            return res.status(404).json({ error: 'Student not found' });
        }
        // Delete old photo if exists
        const oldPath = studentRow.rows[0].photo_path;
        if (oldPath && fs_1.default.existsSync(oldPath))
            fs_1.default.unlink(oldPath, () => { });
        await db_1.pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [file.path, req.params.id]);
        const photo_url = `/uploads/students/${path_1.default.basename(file.path)}`;
        return res.json({ photo_url });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
// GET /api/v1/admin/students/:id/parent-links — list parent accounts linked to a student
router.get('/:id/parent-links', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT pu.id, pu.name, pu.mobile
       FROM parent_student_links psl
       JOIN parent_users pu ON pu.id = psl.parent_id
       WHERE psl.student_id = $1 AND pu.school_id = $2`, [req.params.id, school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/admin/students/:id/parent-links — create/link a parent to a student
// Body: { mobile, name } — creates parent_user if not exists, then links
router.post('/:id/parent-links', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const { mobile, name } = req.body;
        if (!mobile)
            return res.status(400).json({ error: 'mobile is required' });
        // Verify student belongs to school
        const studentRow = await db_1.pool.query('SELECT id FROM students WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        if (studentRow.rows.length === 0)
            return res.status(404).json({ error: 'Student not found' });
        // Find or create parent_user
        let parentRow = await db_1.pool.query('SELECT id FROM parent_users WHERE mobile = $1 AND school_id = $2', [mobile, school_id]);
        if (parentRow.rows.length === 0) {
            // Create parent with mobile as initial password
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash(mobile, 12);
            parentRow = await db_1.pool.query(`INSERT INTO parent_users (school_id, mobile, name, password_hash, force_password_reset)
         VALUES ($1, $2, $3, $4, true) RETURNING id`, [school_id, mobile, name || null, hash]);
        }
        const parent_id = parentRow.rows[0].id;
        // Link parent to student (ignore if already linked)
        await db_1.pool.query(`INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [parent_id, req.params.id]);
        return res.status(201).json({ parent_id, message: 'Parent linked successfully' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/v1/admin/students/:id/parent-links/:parent_id
router.delete('/:id/parent-links/:parent_id', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    try {
        await db_1.pool.query('DELETE FROM parent_student_links WHERE student_id = $1 AND parent_id = $2', [req.params.id, req.params.parent_id]);
        return res.json({ message: 'Parent unlinked' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
