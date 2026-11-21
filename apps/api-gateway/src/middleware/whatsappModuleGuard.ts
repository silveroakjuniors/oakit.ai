/**
 * middleware/whatsappModuleGuard.ts
 * Blocks all WhatsApp API routes when the module is not enabled for the school.
 * Pattern: identical to socialMediaModuleGuard.ts
 */
import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/db';

export async function whatsappModuleGuard(
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
      'SELECT whatsapp_enabled FROM schools WHERE id=$1',
      [school_id],
    );
    if (!row.rows[0]?.whatsapp_enabled) {
      res.status(403).json({
        error: 'WhatsApp module is not enabled for your school.',
        module: 'whatsapp',
      });
      return;
    }
    next();
  } catch (err) {
    console.error('[whatsappModuleGuard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
