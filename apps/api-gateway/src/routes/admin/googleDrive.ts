import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('admin', 'principal'));

// GET /api/v1/admin/google-drive/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // First ensure school_settings row exists
    await pool.query(
      `INSERT INTO school_settings (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING`,
      [school_id]
    );

    const config = await pool.query(
      `SELECT 
        COALESCE(google_drive_enabled, false) as google_drive_enabled,
        google_drive_folder_id,
        google_drive_class_folder,
        COALESCE((SELECT created_at FROM school_settings WHERE school_id = $1), now()) as configured_at
       FROM school_settings 
       WHERE school_id = $1`,
      [school_id]
    );

    return res.json(config.rows[0]);
  } catch (err) {
    console.error('[google drive config]', err);
    return res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// PUT /api/v1/admin/google-drive/config
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { enabled, folder_id, class_folder, auth } = req.body;

    // Validate folder_id if enabled
    if (enabled && (!folder_id || typeof folder_id !== 'string' || folder_id.trim().length === 0)) {
      return res.status(400).json({ error: 'Folder ID is required when Google Drive is enabled' });
    }

    const query = `
      INSERT INTO school_settings (school_id, google_drive_enabled, google_drive_folder_id, google_drive_class_folder, google_drive_auth, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (school_id) DO UPDATE 
      SET google_drive_enabled = EXCLUDED.google_drive_enabled,
          google_drive_folder_id = EXCLUDED.google_drive_folder_id,
          google_drive_class_folder = EXCLUDED.google_drive_class_folder,
          google_drive_auth = EXCLUDED.google_drive_auth,
          updated_at = now()
    `;

    await pool.query(query, [
      school_id,
      enabled !== undefined ? Boolean(enabled) : null,
      folder_id ? folder_id.trim() : null,
      class_folder ? class_folder.trim() : 'SOJS2627',
      auth ? (typeof auth === 'string' ? auth : JSON.stringify(auth)) : null,
    ]);

    return res.json({
      success: true,
      google_drive_enabled: enabled !== undefined ? Boolean(enabled) : false,
      google_drive_folder_id: folder_id ? folder_id.trim() : null,
      google_drive_class_folder: class_folder ? class_folder.trim() : 'SOJS2627',
    });
  } catch (err) {
    console.error('[google drive config update]', err);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// POST /api/v1/admin/google-drive/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const axios = (await import('axios')).default;

    // Check Google Drive config
    const config = await pool.query(
      `SELECT google_drive_enabled, google_drive_folder_id, google_drive_auth, google_drive_class_folder
       FROM school_settings WHERE school_id = $1`,
      [school_id]
    );

    if (config.rows.length === 0 || !config.rows[0].google_drive_enabled) {
      return res.status(400).json({ 
        success: false,
        error: 'Google Drive is not enabled for this school' 
      });
    }

    const driveConfig = config.rows[0];
    
    if (!driveConfig.google_drive_folder_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Google Drive folder ID is not configured' 
      });
    }

    // Check for credentials
    let accessToken: string | null = null;
    if (driveConfig.google_drive_auth) {
      try {
        // pg returns JSONB as a JS object — guard against double-parsing
        const authConfig: any = typeof driveConfig.google_drive_auth === 'string'
          ? JSON.parse(driveConfig.google_drive_auth)
          : driveConfig.google_drive_auth;

        if (authConfig.type === 'service_account' && authConfig.private_key) {
          const { JWT } = await import('google-auth-library');
          const jwtClient = new JWT({
            key:    authConfig.private_key,
            email:  authConfig.client_email,
            scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
          });
          const { access_token } = await jwtClient.authorize();
          accessToken = access_token;
        } else if (authConfig.access_token) {
          accessToken = authConfig.access_token;
        }
      } catch (err: any) {
        return res.status(400).json({ 
          success: false,
          error: `Invalid Google Drive auth configuration: ${err.message}` 
        });
      }
    }

    if (!accessToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Google Drive credentials not configured' 
      });
    }

    // Test connection by uploading a small test file
    const testFileName = `oakit_test_${Date.now()}.txt`;
    const testFileContent = 'This is a test file to verify Google Drive integration.';

    try {
      // Upload test file
      const uploadResponse = await axios.post<{
        id: string;
        webViewLink: string;
      }>(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=media&fields=id,webViewLink`,
        testFileContent,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'text/plain',
          },
          params: {
            fields: 'id,webViewLink',
          },
        }
      );

      // Move file to test folder
      await axios.patch(
        `https://www.googleapis.com/drive/v3/files/${uploadResponse.data.id}`,
        {
          addParents: driveConfig.google_drive_folder_id,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      // Delete the test file
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${uploadResponse.data.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return res.json({
        success: true,
        message: 'Google Drive configuration is valid. Test file uploaded and deleted successfully.',
        testFileId: uploadResponse.data.id,
        folderId: driveConfig.google_drive_folder_id,
      });
    } catch (testErr: any) {
      console.error('[google drive test]', testErr.response?.data || testErr.message);
      const errorMessage = testErr.response?.data?.error?.message || testErr.message || 'Unknown error';
      return res.status(400).json({ 
        success: false,
        error: `Test failed: ${errorMessage}` 
      });
    }
  } catch (err) {
    console.error('[google drive test]', err);
    return res.status(500).json({ error: 'Failed to test configuration' });
  }
});

export default router;
