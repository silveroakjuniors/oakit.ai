import { Router, Request, Response } from 'express';
import axios from 'axios';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { redis } from '../../lib/redis';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const YT_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';
const CACHE_TTL = 60 * 60 * 24; // 24 hours — plan topics don't change intra-day

/**
 * GET /api/v1/teacher/videos?topics=English,Math,Circle+Time&class=Nursery
 * Returns up to 4 YouTube video IDs (one per topic), ranked by view count.
 * Results are cached in Redis for 24h — quota cost is per unique topic set per day.
 */
router.get('/', async (req: Request, res: Response) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.json({ videos: [] });

  // TODO: Super-admin per-school feature flag
  // const { school_id } = req.user!;
  // const enabled = await redis.get(`feature:youtube_videos:${school_id}`);
  // if (!enabled) return res.json({ videos: [], disabled: true });

  const topicsParam = (req.query.topics as string) || '';
  const className   = (req.query.class  as string) || '';

  const topics = topicsParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
  if (topics.length === 0) return res.json({ videos: [] });

  // Cache key: stable per class + topic set per day
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `yt:videos:${today}:${className}:${topics.sort().join(',')}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ videos: JSON.parse(cached), cached: true });
  } catch { /* redis miss — continue */ }

  // Step 1: search for candidates per topic (5 results each)
  const candidatesByTopic: Record<string, { videoId: string; title: string }[]> = {};

  await Promise.all(topics.map(async (topic) => {
    const q = `${className ? className + ' ' : ''}${topic} activity for kids classroom`;
    try {
      const resp = await axios.get(YT_SEARCH, {
        params: { part: 'snippet', q, type: 'video', videoEmbeddable: 'true', safeSearch: 'strict', maxResults: 5, key: apiKey },
        timeout: 5000,
      });
      candidatesByTopic[topic] = (resp.data.items || [])
        .filter((item: any) => item?.id?.videoId)
        .map((item: any) => ({ videoId: item.id.videoId, title: item.snippet.title }));
    } catch (err: any) {
      console.error(`[videos] search error for "${topic}":`, err?.response?.data || err?.message);
      candidatesByTopic[topic] = [];
    }
  }));

  // Step 2: batch-fetch statistics for all candidate IDs (1 quota unit total)
  const allIds = Object.values(candidatesByTopic).flat().map(v => v.videoId);
  const statsMap: Record<string, { viewCount: number; likeCount: number }> = {};

  if (allIds.length > 0) {
    try {
      const statsResp = await axios.get(YT_VIDEOS, {
        params: { part: 'statistics', id: allIds.join(','), key: apiKey },
        timeout: 5000,
      });
      for (const item of statsResp.data.items || []) {
        statsMap[item.id] = {
          viewCount: parseInt(item.statistics?.viewCount || '0', 10),
          likeCount: parseInt(item.statistics?.likeCount || '0', 10),
        };
      }
    } catch (err: any) {
      console.error('[videos] stats fetch error:', err?.response?.data || err?.message);
    }
  }

  // Step 3: pick highest-viewed candidate per topic
  const results: { topic: string; videoId: string; title: string; viewCount: number }[] = [];

  for (const topic of topics) {
    const candidates = candidatesByTopic[topic] || [];
    if (candidates.length === 0) continue;
    const best = candidates.reduce((top, v) =>
      (statsMap[v.videoId]?.viewCount ?? 0) > (statsMap[top.videoId]?.viewCount ?? 0) ? v : top
    );
    results.push({ topic, videoId: best.videoId, title: best.title, viewCount: statsMap[best.videoId]?.viewCount ?? 0 });
  }

  // Cache for 24h so the same class doesn't burn quota on every refresh
  try { await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(results)); } catch { /* ignore */ }

  return res.json({ videos: results });
});

export default router;
