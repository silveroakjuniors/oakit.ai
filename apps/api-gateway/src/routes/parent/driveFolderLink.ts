import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

/**
 * GET /api/v1/parent/drive-folder?section_id=xxx
 * Returns the Google Drive folder URL for the parent's child's class.
 * Falls back to root folder if class-specific subfolder not yet created.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.query;

    // Check if Google Drive is enabled
    const settings = await pool.query(
      `SELECT google_drive_enabled, google_drive_folder_id FROM school_settings WHERE school_id = $1`,
      [school_id]
    );

    if (!settings.rows[0]?.google_drive_enabled || !settings.rows[0]?.google_drive_folder_id) {
      return res.json({ google_drive_enabled: false, drive_folder_url: null });
    }

    const rootFolderId = settings.rows[0].google_drive_folder_id;

    // Try to get the class-specific subfolder (graceful fallback if table doesn't exist)
    if (section_id) {
      let classFolderData: { drive_folder_url?: string; drive_folder_id?: string; class_name?: string } | null = null;

      try {
        // First try by section_id
        const bySection = await pool.query(
          `SELECT drive_folder_id, drive_folder_url, class_name
           FROM drive_class_folders
           WHERE school_id = $1 AND section_id = $2
           LIMIT 1`,
          [school_id, section_id]
        );
        if (bySection.rows.length > 0) classFolderData = bySection.rows[0];
      } catch { /* table may not exist yet */ }

      if (classFolderData) {
        return res.json({
          google_drive_enabled: true,
          drive_folder_url: classFolderData.drive_folder_url ||
            `https://drive.google.com/drive/folders/${classFolderData.drive_folder_id}`,
          class_name: classFolderData.class_name,
        });
      }

      // Try to match by class name
      const sectionRow = await pool.query(
        `SELECT c.name AS class_name, s.label AS section_label
         FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE s.id = $1`,
        [section_id]
      );

      if (sectionRow.rows.length > 0) {
        const { class_name, section_label } = sectionRow.rows[0];
        const folderName = section_label ? `${class_name} - ${section_label}` : class_name;

        try {
          const byName = await pool.query(
            `SELECT drive_folder_id, drive_folder_url FROM drive_class_folders
             WHERE school_id = $1 AND class_name = $2 LIMIT 1`,
            [school_id, folderName]
          );
          if (byName.rows.length > 0) {
            return res.json({
              google_drive_enabled: true,
              drive_folder_url: byName.rows[0].drive_folder_url ||
                `https://drive.google.com/drive/folders/${byName.rows[0].drive_folder_id}`,
              class_name: folderName,
            });
          }
        } catch { /* table may not exist yet */ }

        // Folder not yet created — return root folder
        return res.json({
          google_drive_enabled: true,
          drive_folder_url: `https://drive.google.com/drive/folders/${rootFolderId}`,
          class_name: folderName,
        });
      }
    }

    // No section_id — return root folder
    return res.json({
      google_drive_enabled: true,
      drive_folder_url: `https://drive.google.com/drive/folders/${rootFolderId}`,
      class_name: null,
    });
  } catch (err) {
    console.error('[parent drive-folder]', err);
    return res.status(500).json({ error: 'Failed to load Drive folder link' });
  }
});

export default router;
