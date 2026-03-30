import { Router, Request, Response } from 'express';
import axios from 'axios';
import { redis } from '../lib/redis';
import { getToday } from '../lib/today';
import { jwtVerify, schoolScope, roleGuard } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('teacher', 'principal', 'admin'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const MAX_ACTIVITY_QUESTIONS = 5;
const NUDGE_AT = 3;

// Questions that are always allowed — no limit
const ALWAYS_ALLOWED = [
  'completed','finished','done','covered','taught','did all','except',
  "couldn't do","could not","didn't do","skipped","not done","i did","we did","i covered",
  'yesterday','what did i','what did we','what was covered',
  'progress','on track','lagging','behind','pending topics','am i on track',
  'what is my plan','what\'s my plan','plan for today','plan for tomorrow','my plan',
  'crying','upset','misbehav','not listening','disruptive','shy','quiet',
  'finish early','fast finisher','reward','sticker','parent','discipline',
  'scold','shout','tired','energy','transition','bathroom','toilet',
];

function isAlwaysAllowed(text: string): boolean {
  const t = text.toLowerCase();
  return ALWAYS_ALLOWED.some(w => t.includes(w));
}

// POST /api/v1/ai/query
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id, role } = req.user!;
    const { text, history } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const today = await getToday(school_id);

    // Strip "Ask Oakie:" / "Hey Oakie" prefix before sending to AI
    const cleanText = text.replace(/^(ask\s+oakie[:\s]+|hey\s+o[ak]aie[,:\s]+|o[ak]aie[,:\s]+)/i, '').trim() || text;

    // ── Question limit (teachers only, activity questions only) ──────────
    if (role === 'teacher' && !isAlwaysAllowed(cleanText)) {
      const countKey = `ai:qlimit:${user_id}:${today}`;
      const current = parseInt(await redis.get(countKey) || '0');

      if (current >= MAX_ACTIVITY_QUESTIONS) {
        return res.json({
          response: (
            `You've asked ${MAX_ACTIVITY_QUESTIONS} questions today — great engagement! 🎯\n\n` +
            `Before asking more, please mark your activities as completed using the checkboxes below your plan.\n\n` +
            `Once you've logged today's completion, your question limit resets. 💚`
          ),
          question_limit_reached: true,
          chunk_ids: [],
          covered_chunk_ids: [],
          activity_ids: [],
        });
      }

      // Increment counter (expires at midnight — 24h TTL is fine)
      await redis.setEx(countKey, 86400, String(current + 1));

      // Nudge after NUDGE_AT questions
      if (current + 1 === NUDGE_AT) {
        // Let the question through but we'll append a nudge in the response
        const cacheKey = `ai:${user_id}:${crypto.createHash('md5').update(cleanText + today).digest('hex')}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.response += `\n\n---\n💬 You've asked ${NUDGE_AT} questions today. When you're ready, mark your activities as completed using the checkboxes below.`;
          return res.json(parsed);
        }
        const aiResp = await axios.post(`${AI()}/internal/query`, {
          teacher_id: user_id, school_id, text: cleanText, query_date: today, role,
        }, { timeout: 60000 });
        const data = aiResp.data;
        data.response += `\n\n---\n💬 You've asked ${NUDGE_AT} questions today. When you're ready, mark your activities as completed using the checkboxes below.`;
        await redis.setEx(cacheKey, 10, JSON.stringify(data));
        return res.json(data);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const cacheKey = `ai:${user_id}:${crypto.createHash('md5').update(cleanText + today).digest('hex')}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const aiResp = await axios.post(`${AI()}/internal/query`, {
      teacher_id: user_id,
      school_id,
      text: cleanText,
      query_date: today,
      role,
      history: Array.isArray(history) ? history.slice(-3) : [],
      ...(role === 'principal' && req.body.context ? { context: req.body.context } : {}),
    }, { timeout: 60000 });

    await redis.setEx(cacheKey, 10, JSON.stringify(aiResp.data));
    return res.json(aiResp.data);

  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.detail || err.message : 'AI service unavailable';
    return res.status(503).json({ error: msg });
  }
});

// POST /api/v1/ai/reset-limit — called when teacher marks completion
router.post('/reset-limit', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    await redis.del(`ai:qlimit:${user_id}:${today}`);
    return res.json({ message: 'Question limit reset' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
