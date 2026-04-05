"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('admin'));
const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
function fileChecksum(filePath) {
    const buf = fs_1.default.readFileSync(filePath);
    return crypto_1.default.createHash('sha256').update(buf).digest('hex');
}
// POST /api/v1/admin/curriculum/preview
// Extracts Week 1 only from the PDF and returns it for admin approval before full ingestion
router.post('/preview', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No file uploaded' });
        const start_page = parseInt(req.body.start_page) || 1;
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', require('fs').createReadStream(file.path), { filename: file.originalname });
        form.append('start_page', String(start_page));
        let preview;
        try {
            const aiResp = await axios_1.default.post(`${AI_SERVICE_URL}/internal/preview`, form, {
                headers: form.getHeaders(),
                timeout: 30000,
            });
            preview = aiResp.data;
        }
        finally {
            require('fs').unlink(file.path, () => { });
        }
        return res.json(preview);
    }
    catch (err) {
        console.error('Preview error:', err);
        if (axios_1.default.isAxiosError(err)) {
            console.error('AI service response:', err.response?.status, err.response?.data);
            const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
            return res.status(500).json({ error: `Preview failed: ${msg}` });
        }
        return res.status(500).json({ error: String(err) });
    }
});
// POST /api/v1/admin/curriculum/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { school_id } = req.user;
        const { class_id, force } = req.body;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No file uploaded' });
        if (!class_id)
            return res.status(400).json({ error: 'class_id is required' });
        const checksum = fileChecksum(file.path);
        const start_page = parseInt(req.body.start_page) || 1;
        // Check for existing document for this class
        const existing = await db_1.pool.query('SELECT id, filename FROM curriculum_documents WHERE class_id = $1 AND school_id = $2 AND status != $3', [class_id, school_id, 'failed']);
        if (existing.rows.length > 0 && force !== 'true') {
            fs_1.default.unlinkSync(file.path);
            return res.status(409).json({
                error: 'A curriculum document already exists for this class',
                existing: existing.rows[0],
                requires_confirmation: true,
            });
        }
        // Check duplicate checksum
        const dupCheck = await db_1.pool.query('SELECT id FROM curriculum_documents WHERE checksum = $1 AND class_id = $2', [checksum, class_id]);
        if (dupCheck.rows.length > 0) {
            fs_1.default.unlinkSync(file.path);
            return res.status(409).json({ error: 'This exact file has already been uploaded' });
        }
        // Insert document record
        const docResult = await db_1.pool.query(`INSERT INTO curriculum_documents (school_id, class_id, filename, file_path, checksum, status, uploaded_by, start_page)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7) RETURNING id`, [school_id, class_id, file.originalname, file.path, checksum, req.user.user_id, start_page]);
        const document_id = docResult.rows[0].id;
        // Trigger async ingestion on Python AI service
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        axios_1.default.post(`${AI_SERVICE_URL}/internal/ingest`, { document_id }).catch(err => console.error('Ingestion trigger failed:', err.message));
        return res.status(201).json({ document_id, message: 'Upload received, ingestion started' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/curriculum/:doc_id/status
router.get('/:doc_id/status', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query('SELECT id, filename, status, ingestion_stage, total_chunks, failed_pages, uploaded_at FROM curriculum_documents WHERE id = $1 AND school_id = $2', [req.params.doc_id, school_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Document not found' });
        const row = result.rows[0];
        return res.json({ ...row, stage: row.ingestion_stage });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/curriculum/:doc_id/chunks
router.get('/:doc_id/chunks', async (req, res) => {
    try {
        const { school_id } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const result = await db_1.pool.query(`SELECT id, chunk_index, topic_label, content, page_start, page_end, activity_ids
       FROM curriculum_chunks WHERE document_id = $1 AND school_id = $2
       ORDER BY chunk_index LIMIT $3 OFFSET $4`, [req.params.doc_id, school_id, limit, offset]);
        const count = await db_1.pool.query('SELECT COUNT(*) FROM curriculum_chunks WHERE document_id = $1', [req.params.doc_id]);
        return res.json({ chunks: result.rows, total: parseInt(count.rows[0].count), page, limit });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/v1/admin/curriculum/chunks/:chunk_id — edit a chunk's label and content
router.patch('/chunks/:chunk_id', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { topic_label, content } = req.body;
        if (!topic_label && !content) {
            return res.status(400).json({ error: 'topic_label or content is required' });
        }
        const result = await db_1.pool.query(`UPDATE curriculum_chunks
       SET topic_label = COALESCE($1, topic_label),
           content     = COALESCE($2, content)
       WHERE id = $3 AND school_id = $4
       RETURNING id, chunk_index, topic_label, content`, [topic_label ?? null, content ?? null, req.params.chunk_id, school_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Chunk not found' });
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/curriculum/by-class/:class_id/chunks — paginated chunks for a class (5 per page = 5 days)
router.get('/by-class/:class_id/chunks', async (req, res) => {
    try {
        const { school_id } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;
        // Find the latest ready document for this class
        const docRow = await db_1.pool.query(`SELECT id FROM curriculum_documents
       WHERE class_id = $1 AND school_id = $2 AND status = 'ready'
       ORDER BY uploaded_at DESC LIMIT 1`, [req.params.class_id, school_id]);
        if (docRow.rows.length === 0)
            return res.status(404).json({ error: 'No curriculum found for this class' });
        const doc_id = docRow.rows[0].id;
        const result = await db_1.pool.query(`SELECT id, chunk_index, topic_label, content, page_start, page_end
       FROM curriculum_chunks WHERE document_id = $1 AND school_id = $2
       ORDER BY chunk_index LIMIT $3 OFFSET $4`, [doc_id, school_id, limit, offset]);
        const count = await db_1.pool.query('SELECT COUNT(*) FROM curriculum_chunks WHERE document_id = $1', [doc_id]);
        return res.json({
            doc_id,
            chunks: result.rows,
            total: parseInt(count.rows[0].count),
            page,
            limit,
            total_pages: Math.ceil(parseInt(count.rows[0].count) / limit),
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/curriculum — list all docs for school
router.get('/', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT cd.id, cd.filename, cd.status, cd.total_chunks, cd.uploaded_at, c.name as class_name
       FROM curriculum_documents cd JOIN classes c ON cd.class_id = c.id
       WHERE cd.school_id = $1 ORDER BY cd.uploaded_at DESC`, [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
