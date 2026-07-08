/**
 * Franchise curriculum routes (Req 3, 11)
 *
 * GET    /api/v1/franchise/classes                    — list franchise classes
 * POST   /api/v1/franchise/classes                    — create franchise class
 * GET    /api/v1/franchise/classes/:id/chunks         — list chunks (with week/day)
 * POST   /api/v1/franchise/classes/:id/upload         — upload curriculum PDF
 * PATCH  /api/v1/franchise/classes/:id/chunks/:chunkId — edit topic_label
 * POST   /api/v1/franchise/classes/:id/approve        — approve curriculum
 * POST   /api/v1/franchise/classes/:id/reject         — reject / re-upload
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, franchiseScope } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, franchiseScope);

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const upload = multer({
  dest: '/tmp/franchise-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

function getFranchiseId(req: Request): string {
  return (req.user as any).franchise_id;
}

// ── List franchise classes ────────────────────────────────────────────────────
router.get('/classes', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const result = await pool.query(
      `SELECT fc.id, fc.name, fc.description, fc.created_at,
              COUNT(DISTINCT cd.id)::int AS document_count,
              COUNT(DISTINCT cc.id)::int AS chunk_count,
              MAX(cd.status) AS latest_status
       FROM franchise_classes fc
       LEFT JOIN curriculum_documents cd ON cd.franchise_class_id = fc.id
       LEFT JOIN curriculum_chunks cc ON cc.franchise_id = $1 AND cc.document_id = cd.id
       WHERE fc.franchise_id = $1
       GROUP BY fc.id ORDER BY fc.name`,
      [franchiseId]
    );

    return res.json(result.rows.map((r: any) => ({
      ...r,
      total_weeks: Math.ceil(r.chunk_count / 5),
      estimated_teaching_days: r.chunk_count,
    })));
  } catch (err) {
    console.error('[franchise/classes]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Create franchise class ────────────────────────────────────────────────────
router.post('/classes', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `INSERT INTO franchise_classes (franchise_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at`,
      [franchiseId, name.trim(), description ?? null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Class name already exists in this franchise' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get chunks for a franchise class (Req 11.3 — Week/Day format) ─────────────
router.get('/classes/:id/chunks', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const page = Math.max(1, parseInt(req.query.page as string || '1'));
    const limit = 25;
    const offset = (page - 1) * limit;

    // Verify class belongs to franchise
    const cls = await pool.query(
      'SELECT id, name FROM franchise_classes WHERE id = $1 AND franchise_id = $2',
      [req.params.id, franchiseId]
    );
    if (cls.rows.length === 0) return res.status(404).json({ error: 'Class not found' });

    // Get latest approved (or most recent) document
    const doc = await pool.query(
      `SELECT id, filename, status, total_chunks, uploaded_at
       FROM curriculum_documents
       WHERE franchise_class_id = $1 AND franchise_id = $2
       ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'ready' THEN 1 ELSE 2 END, uploaded_at DESC
       LIMIT 1`,
      [req.params.id, franchiseId]
    );

    if (doc.rows.length === 0) {
      return res.json({ class: cls.rows[0], document: null, chunks: [], total: 0, page, pages: 0 });
    }

    const totalRow = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM curriculum_chunks WHERE document_id = $1',
      [doc.rows[0].id]
    );
    const total = totalRow.rows[0].cnt;

    const chunks = await pool.query(
      `SELECT id, chunk_index, topic_label,
              LEFT(content, 200) AS content_preview,
              page_start, page_end
       FROM curriculum_chunks
       WHERE document_id = $1
       ORDER BY chunk_index
       LIMIT $2 OFFSET $3`,
      [doc.rows[0].id, limit, offset]
    );

    // Derive week_number and day_number from chunk_index (1-based, 5 days/week)
    const enriched = chunks.rows.map((c: any) => ({
      ...c,
      week_number: Math.floor(c.chunk_index / 5) + 1,
      day_number: (c.chunk_index % 5) + 1,
    }));

    return res.json({
      class: cls.rows[0],
      document: doc.rows[0],
      chunks: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
      total_weeks: Math.ceil(total / 5),
      estimated_teaching_days: total,
    });
  } catch (err) {
    console.error('[franchise/classes/:id/chunks]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Upload curriculum PDF ─────────────────────────────────────────────────────
router.post('/classes/:id/upload', (req: Request, res: Response, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const cls = await pool.query(
      'SELECT id, name FROM franchise_classes WHERE id = $1 AND franchise_id = $2',
      [req.params.id, franchiseId]
    );
    if (cls.rows.length === 0) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: 'Class not found' });
    }

    // Create document record (franchise-owned: school_id = null)
    const docResult = await pool.query(
      `INSERT INTO curriculum_documents
         (franchise_id, franchise_class_id, school_id, class_id, filename, file_path, checksum, status, uploaded_by)
       VALUES ($1, $2, NULL, NULL, $3, $4, $5, 'pending', $6)
       ON CONFLICT (class_id, checksum) DO NOTHING
       RETURNING id`,
      [franchiseId, req.params.id, file.originalname, file.path,
       require('crypto').createHash('md5').update(fs.readFileSync(file.path)).digest('hex'),
       (req.user as any).user_id]
    );

    if (docResult.rows.length === 0) {
      fs.unlink(file.path, () => {});
      return res.status(409).json({ error: 'This curriculum file has already been uploaded' });
    }

    const docId = docResult.rows[0].id;

    // Trigger async ingestion
    const form = new FormData();
    form.append('file', fs.createReadStream(file.path), file.originalname);
    form.append('document_id', docId);
    form.append('franchise_id', franchiseId);
    form.append('class_name', cls.rows[0].name);

    axios.post(`${AI()}/internal/ingest`, form, {
      headers: form.getHeaders(),
      timeout: 300000,
    }).then(async () => {
      await pool.query(
        "UPDATE curriculum_documents SET status = 'ready' WHERE id = $1",
        [docId]
      );
    }).catch(async () => {
      await pool.query(
        "UPDATE curriculum_documents SET status = 'failed' WHERE id = $1",
        [docId]
      );
    }).finally(() => fs.unlink(file.path, () => {}));

    return res.status(202).json({
      document_id: docId,
      status: 'pending',
      message: 'Curriculum is being processed. Check back in a few minutes.',
    });
  } catch (err) {
    console.error('[franchise/classes/:id/upload]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Edit chunk topic_label (Req 11.8 — propagates to all member schools) ──────
router.patch('/classes/:id/chunks/:chunkId', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const { topic_label } = req.body;
    if (!topic_label?.trim()) return res.status(400).json({ error: 'topic_label is required' });

    // Verify chunk belongs to this franchise
    const result = await pool.query(
      `UPDATE curriculum_chunks SET topic_label = $1
       WHERE id = $2 AND franchise_id = $3
       RETURNING id, chunk_index, topic_label`,
      [topic_label.trim(), req.params.chunkId, franchiseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Chunk not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Approve curriculum (Req 11.5) ─────────────────────────────────────────────
router.post('/classes/:id/approve', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const { document_id } = req.body;
    if (!document_id) return res.status(400).json({ error: 'document_id required' });

    const result = await pool.query(
      `UPDATE curriculum_documents SET status = 'approved'
       WHERE id = $1 AND franchise_id = $2 AND franchise_class_id = $3
       RETURNING id, status`,
      [document_id, franchiseId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    return res.json({ success: true, status: 'approved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reject / reset for re-upload (Req 11.6) ───────────────────────────────────
router.post('/classes/:id/reject', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    const { document_id } = req.body;
    if (!document_id) return res.status(400).json({ error: 'document_id required' });

    // Delete old chunks and reset document status
    await pool.query(
      'DELETE FROM curriculum_chunks WHERE document_id = $1 AND franchise_id = $2',
      [document_id, franchiseId]
    );
    await pool.query(
      `UPDATE curriculum_documents SET status = 'pending_review'
       WHERE id = $1 AND franchise_id = $2`,
      [document_id, franchiseId]
    );
    return res.json({ success: true, status: 'pending_review' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
