/**
 * middleware/socialMediaModuleGuard.ts
 * Blocks all social media API routes when the module is not enabled for the school.
 */
import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/db';

export async function socialMediaModuleGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const school_id = (req.user as any)?.school_id;
    if (!school_id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const row = await pool.query(
      'SELECT social_media_enabled FROM schools WHERE id=$1',
      [school_id],
    );
    if (!row.rows[0]?.social_media_enabled) {
      res.status(403).json({
        error: 'Social Media Publisher module is not enabled for your school.',
        module: 'social_media',
      });
      return;
    }
    next();
  } catch (err) {
    console.error('[socialMediaModuleGuard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
