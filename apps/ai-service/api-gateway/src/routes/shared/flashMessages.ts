/**
 * Flash message routes
 *
 * GET  /api/v1/flash-messages                    — active messages for caller's role
 * GET  /api/v1/flash-messages/tomorrow-preview   — tomorrow's event/holiday preview (for parents/teachers)
 * POST /api/v1/admin/flash-messages              — create a message (admin only)
 * PUT  /api/v1/admin/flash-messages/:id          — update
 * DELETE /api/v1/admin/flash-messages/:id        — delete
 * GET  /api/v1/admin/flash-messages              — list all (admin only)
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import axios from 'axios';

// ── Known event descriptions (fallback when AI unavailable) ──────────────────
const EVENT_INFO: Record<string, { emoji: string; body: string }> = {
  'independence day': {
    emoji: '🇮🇳',
    body: 'Tomorrow we celebrate 78 years of India\'s independence! On August 15, 1947, India gained freedom after years of struggle. It is a day to remember our freedom fighters and feel proud of our great nation. School will observe this holiday.',
  },
  'republic day': {
    emoji: '🇮🇳',
    body: 'Tomorrow is Republic Day! On January 26, 1950, India adopted its Constitution and became a republic. A day of national pride, parades, and patriotic celebrations. School will observe this holiday.',
  },
  'gandhi jayanti': {
    emoji: '🕊️',
    body: 'Tomorrow is Gandhi Jayanti — the birthday of Mahatma Gandhi, the Father of our Nation. He led India to independence through non-violence and truth. A national holiday dedicated to his memory.',
  },
  'ganesh chaturthi': {
    emoji: '🐘',
    body: 'Tomorrow is Ganesh Chaturthi! This joyful festival celebrates the birth of Lord Ganesha, the remover of obstacles and the god of wisdom. Families bring home Ganesha idols and celebrate with prayers, sweets, and music.',
  },
  'diwali': {
    emoji: '🪔',
    body: 'Tomorrow is Diwali — the Festival of Lights! It celebrates the triumph of light over darkness, good over evil. Families light diyas, burst crackers, share sweets, and pray to Goddess Lakshmi for prosperity.',
  },
  'holi': {
    emoji: '🎨',
    body: 'Tomorrow is Holi — the Festival of Colors! One of India\'s most joyful festivals celebrating the arrival of spring and the victory of good over evil. Children love throwing colored powder and water on each other!',
  },
  'eid': {
    emoji: '🌙',
    body: 'Tomorrow is Eid Mubarak! A joyous Islamic festival marking the end of Ramadan (fasting month) or Eid al-Adha. Families offer prayers, share delicious food, and celebrate together.',
  },
  'christmas': {
    emoji: '🎄',
    body: 'Tomorrow is Christmas! Celebrated on December 25th, it marks the birth of Jesus Christ. A time of joy, giving, and togetherness — families decorate trees, exchange gifts, and celebrate with carols.',
  },
  'pongal': {
    emoji: '🌾',
    body: 'Tomorrow is Pongal — a harvest festival of South India! It is a time to thank the Sun God for a bountiful harvest. Families cook the traditional sweet rice dish "Pongal" and decorate their homes with kolam.',
  },
  'onam': {
    emoji: '🌸',
    body: 'Tomorrow is Onam — Kerala\'s grandest harvest festival! It celebrates the homecoming of the legendary King Mahabali. Known for the beautiful Pookalam (flower carpet), Onam Sadya feast, and Vallam Kali boat races.',
  },
  'ugadi': {
    emoji: '🌺',
    body: 'Tomorrow is Ugadi — the Telugu and Kannada New Year! It marks the beginning of a new Hindu calendar year. Families clean their homes, wear new clothes, and make Ugadi Pachadi — a dish with six tastes representing life.',
  },
  'navratri': {
    emoji: '💃',
    body: 'Tomorrow begins Navratri — nine nights of worshipping Goddess Durga! It is one of the most vibrant Hindu festivals with colorful Garba and Dandiya dances, prayers, and fasting. Each day honors a different form of the goddess.',
  },
  'dussehra': {
    emoji: '🏹',
    body: 'Tomorrow is Dussehra (Vijayadashami)! It celebrates the victory of Lord Rama over Ravana and the triumph of good over evil. Giant effigies of Ravana are burned across India in grand celebrations.',
  },
  'teachers day': {
    emoji: '👩‍🏫',
    body: 'Tomorrow is Teachers\' Day! Celebrated on September 5th, the birthday of Dr. Sarvepalli Radhakrishnan, it honors the invaluable contribution of teachers in shaping young minds. Our teachers are our heroes!',
  },
  'childrens day': {
    emoji: '🧒',
    body: 'Tomorrow is Children\'s Day! Celebrated on November 14th — the birthday of Pandit Jawaharlal Nehru, who loved children dearly. It is a day to celebrate the joy, innocence, and potential of every child.',
  },
};

function getEventInfo(label: string): { emoji: string; body: string } | null {
  const lower = label.toLowerCase();
  for (const [key, val] of Object.entries(EVENT_INFO)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ── Public (any authenticated user) ─────────────────────────────────────────
export const flashMessagesRouter = Router();
flashMessagesRouter.use(jwtVerify, forceResetGuard, schoolScope);

flashMessagesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id, role } = req.user!;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT id, title, body, start_date, end_date, target_roles
       FROM flash_messages
       WHERE school_id = $1
         AND is_active = true
         AND start_date <= $2::date
         AND end_date   >= $2::date
         AND (target_roles = 'all' OR target_roles ILIKE '%' || $3 || '%')
       ORDER BY created_at DESC`,
      [school_id, today, role]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[flash-messages GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/flash-messages/tomorrow-preview
// Returns a popup message if tomorrow is a holiday or event on the school calendar
flashMessagesRouter.get('/tomorrow-preview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowFmt = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    // Check if tomorrow is a holiday or event in the school calendar
    const dayRow = await pool.query(
      `SELECT label, day_type, activity_note FROM special_days
       WHERE school_id = $1 AND day_date = $2::date
       LIMIT 1`,
      [school_id, tomorrowStr]
    );

    if (dayRow.rows.length === 0) {
      return res.json(null); // Nothing special tomorrow
    }

    const { label, day_type, activity_note } = dayRow.rows[0];

    // Skip settling/revision days — only holidays and events
    if (!['holiday', 'event'].includes(day_type)) {
      return res.json(null);
    }

    const isHoliday = day_type === 'holiday';

    // Try to get event info from our knowledge base
    const known = getEventInfo(label);

    let title: string;
    let body: string;

    if (known) {
      title = `${known.emoji} Tomorrow: ${label}`;
      body = `${known.body}\n\nSilver Oak Juniors wishes all our families a wonderful ${label}!`;
      if (isHoliday) {
        body += '\n\nSchool will be closed tomorrow. See you back on the next school day!';
      } else {
        body += `\n\nTomorrow (${tomorrowFmt}), Silver Oak Juniors celebrates ${label} with special activities for our little ones!`;
      }
    } else {
      // Generic message
      title = isHoliday
        ? `School Holiday Tomorrow`
        : `Special Event Tomorrow: ${label}`;
      body = isHoliday
        ? `Silver Oak Juniors will be closed tomorrow (${tomorrowFmt}) on the occasion of ${label}.\n\nHave a wonderful day with your family! We will see your child back in school on the next working day.`
        : `Tomorrow (${tomorrowFmt}) is a special day at Silver Oak Juniors — ${label}!\n\n${activity_note || 'Our little ones will have a fun and memorable day celebrating this occasion with their teachers and friends.'}`;

      // Try to enrich with AI (non-blocking — fallback to generic if it fails)
      try {
        const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const aiResp = await axios.post(`${AI_URL}/internal/query`, {
          message: `Write a warm, 3-sentence message for parents of preschool children about tomorrow being ${label}${isHoliday ? ' (school holiday)' : ' (school event)'}. Include a brief cultural or contextual note about what this occasion means. Keep it under 60 words. No emojis in the text itself.`,
          school_id,
          teacher_id: 'system',
        }, { timeout: 8000 });

        const aiText = (aiResp.data?.answer || aiResp.data?.response || '').trim();
        if (aiText && aiText.length > 20) {
          body = isHoliday
            ? `${aiText}\n\nSchool is closed tomorrow. See you back on the next school day!`
            : `${aiText}`;
        }
      } catch { /* AI unavailable — use generic message */ }
    }

    // Cache key for frontend sessionStorage
    const cacheKey = `tomorrow_${tomorrowStr}_${school_id}`;

    return res.json({ id: cacheKey, title, body, is_tomorrow_event: true, day_type, label });
  } catch (err) {
    console.error('[flash-messages/tomorrow-preview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin management ─────────────────────────────────────────────────────────
export const adminFlashMessagesRouter = Router();
adminFlashMessagesRouter.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// GET all (for admin management UI)
adminFlashMessagesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT fm.*, u.name as created_by_name
       FROM flash_messages fm
       LEFT JOIN users u ON u.id = fm.created_by
       WHERE fm.school_id = $1
       ORDER BY fm.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create
adminFlashMessagesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { title, body, target_roles = 'parent', start_date, end_date } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body?.trim())  return res.status(400).json({ error: 'Message body is required' });
    if (!start_date)    return res.status(400).json({ error: 'Start date is required' });
    if (!end_date)      return res.status(400).json({ error: 'End date is required' });
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const result = await pool.query(
      `INSERT INTO flash_messages (school_id, title, body, target_roles, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [school_id, title.trim(), body.trim(), target_roles, start_date, end_date, user_id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[flash-messages POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update
adminFlashMessagesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { title, body, target_roles, start_date, end_date, is_active } = req.body;

    const result = await pool.query(
      `UPDATE flash_messages
       SET title = COALESCE($3, title),
           body  = COALESCE($4, body),
           target_roles = COALESCE($5, target_roles),
           start_date   = COALESCE($6, start_date),
           end_date     = COALESCE($7, end_date),
           is_active    = COALESCE($8, is_active),
           updated_at   = now()
       WHERE id = $1 AND school_id = $2
       RETURNING *`,
      [req.params.id, school_id, title, body, target_roles, start_date, end_date, is_active]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE
adminFlashMessagesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `DELETE FROM flash_messages WHERE id = $1 AND school_id = $2`,
      [req.params.id, school_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
