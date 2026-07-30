import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadToGoogleDrive } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'class teacher', 'supporting teacher'));

// Upload limit: 50MB for photos/videos
const upload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedImage.includes(file.mimetype) || allowedVideo.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only photos (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, MOV) are allowed'));
    }
  },
});

/**
 * POST /api/v1/teacher/media/upload
 * Upload a photo or video to Google Drive
 * 
 * Request body:
 * - media: File field containing the photo/video
 * - event_name: (optional) Event name for subfolder
 */
router.post('/upload', (req: Request, res: Response, next: any) => {
  upload.single('media')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File must be under 50 MB' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const file = req.file;
    const { event_name } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check Google Drive is enabled for this school
    const config = await pool.query(
      `SELECT google_drive_enabled, google_drive_folder_id, google_drive_class_folder 
       FROM school_settings WHERE school_id = $1`,
      [school_id]
    );

    if (config.rows.length === 0 || !config.rows[0].google_drive_enabled || !config.rows[0].google_drive_folder_id) {
      return res.status(400).json({ 
        error: 'Google Drive is not configured for this school. Please contact admin.' 
      });
    }

    const folderId = config.rows[0].google_drive_folder_id;
    const baseFolderName = config.rows[0].google_drive_class_folder || 'SOJS2627';
    const today = new Date().toISOString().split('T')[0];
    
    // Build folder path: SOJS2627/YYYY-MM-DD[/EventName]
    let driveFolderName = `${baseFolderName}/${today}`;
    if (event_name && typeof event_name === 'string' && event_name.trim()) {
      driveFolderName += `/${event_name.trim()}`;
    }

    console.log('[media upload] school=%s folder_id=%s path=%s', school_id, folderId, driveFolderName);

    // Upload to Google Drive
    const result = await uploadToGoogleDrive({
      schoolId: school_id,
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      actorId: user_id,
      actorName: (req.user as any).name || 'Teacher',
      actorRole: req.user!.role,
      folderId: folderId,
      driveFolderName: driveFolderName,
    });

    return res.status(201).json({
      success: true,
      file_id: result.driveFileId,
      drive_url: result.driveUrl,
      display_url: result.driveUrl,
      file_name: file.originalname,
      folder_path: driveFolderName,
      file_type: file.mimetype.split('/')[0],
    });
  } catch (err: any) {
    const detail = err?.response?.data?.error || err?.response?.data || err?.message || err;
    console.error('[media upload error]', JSON.stringify(detail));
    return res.status(500).json({ error: err.message || 'Upload failed. Please try again.' });
  }
});

/**
 * GET /api/v1/teacher/media/config
 * Get Google Drive configuration for the current school
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // Upsert a settings row if one doesn't exist yet
    await pool.query(
      `INSERT INTO school_settings (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING`,
      [school_id]
    );

    const config = await pool.query(
      `SELECT 
        COALESCE(google_drive_enabled, false)    AS google_drive_enabled,
        google_drive_folder_id,
        google_drive_class_folder,
        google_drive_auth IS NOT NULL            AS auth_configured
       FROM school_settings
       WHERE school_id = $1`,
      [school_id]
    );

    const row = config.rows[0] ?? {
      google_drive_enabled: false,
      google_drive_folder_id: null,
      google_drive_class_folder: null,
      auth_configured: false,
    };

    console.log('[media config] school_id=%s enabled=%s folder=%s auth=%s',
      school_id, row.google_drive_enabled, row.google_drive_folder_id, row.auth_configured);

    return res.json(row);
  } catch (err) {
    console.error('[media config]', err);
    return res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * GET /api/v1/teacher/media/list
 * Get list of media uploaded to Google Drive (optional: filtered by note_id)
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { note_id } = req.query;

    // Query audit logs for media uploads from this school
    let query = `
      SELECT 
        al.id,
        al.metadata,
        al.created_at
      FROM audit_logs al
      WHERE al.school_id = $1 
        AND al.action = 'upload_photo'
        AND al.entity_type = 'google_drive_media'
    `;
    const params = [school_id];

    if (note_id) {
      query += ` AND al.entity_id = $2`;
      params.push(String(note_id));
    }

    query += ` ORDER BY al.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Extract file info from metadata
    const media = result.rows.map((row: any) => ({
      id: row.id,
      file_name: row.metadata?.file_name || 'Unknown file',
      file_size: row.metadata?.file_size || 0,
      drive_file_id: row.metadata?.drive_file_id,
      drive_url: row.metadata?.drive_url,
      created_at: row.created_at,
    }));

    return res.json({ media });
  } catch (err) {
    console.error('[media list]', err);
    return res.status(500).json({ error: 'Failed to load media list' });
  }
});

export default router;
