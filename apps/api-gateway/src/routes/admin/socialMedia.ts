/**
 * routes/admin/socialMedia.ts
 * Admin routes for Social Media Publisher module.
 * All routes gated by socialMediaModuleGuard.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { socialMediaModuleGuard } from '../../middleware/socialMediaModuleGuard';
import { encryptCredential, decryptCredential } from '../../lib/credentialEncryption';
import { publishPost, retryFailedPlatforms } from '../../lib/socialMediaPublisher';
import { deleteDriveFile } from '../../lib/driveDelete';
import crypto from 'crypto';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'), socialMediaModuleGuard);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/social-media/config
// Returns all platform configs for the school (tokens masked)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const rows = await pool.query(
      `SELECT platform, enabled, token_expires_at, page_id, account_id, handle,
              connected_at, extra_config, app_id,
              CASE WHEN access_token IS NOT NULL THEN true ELSE false END as has_token
       FROM social_media_configs WHERE school_id=$1 ORDER BY platform`,
      [school_id],
    );

    // Return one entry per platform, filling in defaults for unconfigured ones
    const platforms = ['instagram', 'facebook', 'youtube', 'twitter', 'linkedin'];
    const configMap: Record<string, any> = {};
    for (const row of rows.rows) configMap[row.platform] = row;

    const result = platforms.map(p => ({
      platform: p,
      enabled: configMap[p]?.enabled ?? false,
      connected: configMap[p]?.has_token ?? false,
      token_expires_at: configMap[p]?.token_expires_at ?? null,
      page_id: configMap[p]?.page_id ?? null,
      account_id: configMap[p]?.account_id ?? null,
      handle: configMap[p]?.handle ?? null,
      connected_at: configMap[p]?.connected_at ?? null,
      extra_config: configMap[p]?.extra_config ?? null,
      app_id: configMap[p]?.app_id ?? null,  // returned so it can be pre-filled in edit form
    }));

    return res.json(result);
  } catch (err) {
    console.error('[social-media config GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/admin/social-media/config/:platform
// Save or update platform credentials
// ─────────────────────────────────────────────────────────────────────────────
router.put('/config/:platform', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { platform } = req.params;
    const VALID = ['instagram', 'facebook', 'youtube', 'twitter', 'linkedin'];
    if (!VALID.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });

    const { access_token, refresh_token, page_id, account_id, handle, enabled, extra_config, token_expires_at, app_id, app_secret } = req.body;

    // Encrypt sensitive fields
    let encToken: string | undefined;
    let encRefresh: string | undefined;
    let encAppSecret: string | undefined;
    try {
      encToken     = access_token  ? encryptCredential(access_token)  : undefined;
      encRefresh   = refresh_token ? encryptCredential(refresh_token) : undefined;
      encAppSecret = app_secret    ? encryptCredential(app_secret)    : undefined;
    } catch (encErr: any) {
      console.error('[social-media config PUT] encryption error:', encErr?.message);
      return res.status(500).json({ error: `Encryption config error: ${encErr?.message}` });
    }

    await pool.query(
      `INSERT INTO social_media_configs
         (school_id, platform, enabled, access_token, refresh_token, token_expires_at,
          page_id, account_id, handle, app_id, app_secret, extra_config, connected_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
       ON CONFLICT (school_id, platform) DO UPDATE
         SET enabled         = COALESCE($3, social_media_configs.enabled),
             access_token    = COALESCE($4, social_media_configs.access_token),
             refresh_token   = COALESCE($5, social_media_configs.refresh_token),
             token_expires_at= COALESCE($6, social_media_configs.token_expires_at),
             page_id         = COALESCE($7, social_media_configs.page_id),
             account_id      = COALESCE($8, social_media_configs.account_id),
             handle          = COALESCE($9, social_media_configs.handle),
             app_id          = COALESCE($10, social_media_configs.app_id),
             app_secret      = COALESCE($11, social_media_configs.app_secret),
             extra_config    = COALESCE($12, social_media_configs.extra_config),
             connected_at    = CASE WHEN $4 IS NOT NULL THEN now() ELSE social_media_configs.connected_at END,
             updated_at      = now()`,
      [school_id, platform, enabled ?? true, encToken, encRefresh, token_expires_at,
       page_id, account_id, handle, app_id || null, encAppSecret, extra_config ? JSON.stringify(extra_config) : null],
    );

    return res.json({ message: `${platform} configuration saved` });
  } catch (err) {
    console.error('[social-media config PUT]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/social-media/config/:platform
// Disconnect a platform (clear token, disable)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/config/:platform', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { platform } = req.params;
    await pool.query(
      `UPDATE social_media_configs
       SET access_token=NULL, refresh_token=NULL, token_expires_at=NULL,
           enabled=false, connected_at=NULL, updated_at=now()
       WHERE school_id=$1 AND platform=$2`,
      [school_id, platform],
    );
    return res.json({ message: `${platform} disconnected` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/config/:platform/refresh-token
// Exchange the stored long-lived token for a fresh 60-day token using app credentials
// ─────────────────────────────────────────────────────────────────────────────
router.post('/config/:platform/refresh-token', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { platform } = req.params;

    const row = await pool.query(
      'SELECT access_token, app_id, app_secret FROM social_media_configs WHERE school_id=$1 AND platform=$2',
      [school_id, platform],
    );
    if (!row.rows.length || !row.rows[0].access_token) {
      return res.status(400).json({ error: 'No credentials configured for this platform' });
    }
    if (!row.rows[0].app_id || !row.rows[0].app_secret) {
      return res.status(400).json({ error: 'Meta App ID and App Secret are required for auto-refresh. Edit the platform config to add them.' });
    }

    const currentToken = decryptCredential(row.rows[0].access_token);
    const appId = row.rows[0].app_id;
    const appSecret = decryptCredential(row.rows[0].app_secret);

    // Exchange current long-lived token for a fresh one
    const refreshRes = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        },
        timeout: 10000,
      },
    );

    const newToken = refreshRes.data?.access_token;
    if (!newToken) {
      return res.status(502).json({ error: 'Meta did not return a new token' });
    }

    // Calculate expiry (60 days from now)
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const encNewToken = encryptCredential(newToken);

    await pool.query(
      `UPDATE social_media_configs
       SET access_token=$1, token_expires_at=$2, updated_at=now()
       WHERE school_id=$3 AND platform=$4`,
      [encNewToken, expiresAt, school_id, platform],
    );

    return res.json({ message: `Token refreshed successfully. New token expires ${new Date(expiresAt).toLocaleDateString('en-IN')}.`, expires_at: expiresAt });
  } catch (err: any) {
    const metaErr = err?.response?.data?.error?.message;
    console.error('[refresh-token]', metaErr || err?.message);
    return res.status(500).json({ error: metaErr || 'Token refresh failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/config/:platform/test
// Test connection — calls platform API to verify token
// ─────────────────────────────────────────────────────────────────────────────
router.post('/config/:platform/test', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { platform } = req.params;

    const row = await pool.query(
      'SELECT access_token, page_id, account_id FROM social_media_configs WHERE school_id=$1 AND platform=$2',
      [school_id, platform],
    );
    if (!row.rows.length || !row.rows[0].access_token) {
      return res.status(400).json({ success: false, error: 'No credentials configured for this platform' });
    }

    const token = decryptCredential(row.rows[0].access_token);
    const pageId = row.rows[0].page_id;
    const accountId = row.rows[0].account_id;

    let result: { success: boolean; account_name?: string; followers?: number; error?: string; help?: string };

    try {
      switch (platform) {
        case 'instagram': {
          const r = await axios.get(
            `https://graph.facebook.com/v19.0/${accountId}?fields=id,name,username,followers_count&access_token=${token}`,
            { timeout: 10000 },
          );
          result = { success: true, account_name: r.data.username || r.data.name, followers: r.data.followers_count };
          break;
        }
        case 'facebook': {
          const r = await axios.get(
            `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`,
            { timeout: 10000 },
          );
          result = { success: true, account_name: r.data.name };
          break;
        }
        case 'youtube': {
          const r = await axios.get(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
          );
          const channel = r.data.items?.[0];
          result = { success: true, account_name: channel?.snippet?.title || 'YouTube Channel' };
          break;
        }
        case 'twitter': {
          const r = await axios.get(
            'https://api.twitter.com/2/users/me',
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
          );
          result = { success: true, account_name: `@${r.data.data?.username}` };
          break;
        }
        case 'linkedin': {
          const r = await axios.get(
            'https://api.linkedin.com/v2/userinfo',
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
          );
          result = { success: true, account_name: r.data.name || r.data.sub };
          break;
        }
        default:
          result = { success: false, error: 'Unknown platform' };
      }
    } catch (apiErr: any) {
      const status = apiErr?.response?.status;
      const msg = apiErr?.response?.data?.error?.message || apiErr?.message || 'Connection failed';
      result = {
        success: false,
        error: msg,
        help: status === 401 || status === 403
          ? 'Your token may have expired or permissions are insufficient. Please reconnect.'
          : 'Check your credentials and try again.',
      };
    }

    return res.json({ ...result, platform });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/social-media/posts
// List all posts for the school (approval queue + history)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status } = req.query;

    const conditions = ['smp.school_id=$1'];
    const params: any[] = [school_id];
    if (status) { conditions.push(`smp.status=$${params.length + 1}`); params.push(status); }

    const result = await pool.query(
      `SELECT smp.id, smp.media_type, smp.media_paths, smp.raw_caption, smp.ai_caption,
              smp.final_caption, smp.hashtags, smp.status, smp.rejection_reason,
              smp.submitted_at, smp.published_at,
              u.name AS teacher_name,
              COALESCE(
                json_agg(json_build_object('platform', pf.platform, 'status', pf.status, 'error', pf.error_message))
                FILTER (WHERE pf.id IS NOT NULL), '[]'
              ) AS platforms
       FROM social_media_posts smp
       JOIN users u ON u.id = smp.teacher_id
       LEFT JOIN social_media_post_platforms pf ON pf.post_id = smp.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY smp.id, u.name
       ORDER BY smp.submitted_at DESC`,
      params,
    );
    return res.json(result.rows.map((row: any) => ({
      ...row,
      media_urls: (row.media_paths || []).map((p: string) => {
        if (!p.startsWith('google_drive:')) return null;
        const fileId = p.replace('google_drive:', '');
        const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'change_me')
          .update(`${fileId}:${school_id}`).digest('hex').slice(0, 16);
        return `/api/v1/drive-proxy?id=${fileId}&school=${school_id}&sig=${sig}`;
      }).filter(Boolean),
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/posts/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/posts/:id/approve', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { id } = req.params;
    const { edited_caption, edited_hashtags } = req.body;

    const post = await pool.query(
      'SELECT id, status, school_id FROM social_media_posts WHERE id=$1 AND school_id=$2',
      [id, school_id],
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (post.rows[0].status !== 'pending_approval') {
      return res.status(400).json({ error: 'Post is not in pending_approval state' });
    }

    // Update final caption if admin edited
    await pool.query(
      `UPDATE social_media_posts
       SET status='approved', approved_by=$1, approved_at=now(),
           final_caption=COALESCE($3, ai_caption, raw_caption),
           hashtags=COALESCE($4::text[], hashtags),
           updated_at=now()
       WHERE id=$2`,
      [user_id, id, edited_caption || null, edited_hashtags || null],
    );

    // Trigger publisher asynchronously
    publishPost(id, school_id).catch(err =>
      console.error(`[approve] Publisher error for post ${id}:`, err),
    );

    return res.json({ message: 'Post approved and publishing started' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/posts/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post('/posts/:id/reject', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'rejection reason is required' });

    const post = await pool.query(
      'SELECT id, status FROM social_media_posts WHERE id=$1 AND school_id=$2',
      [id, school_id],
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (post.rows[0].status !== 'pending_approval') {
      return res.status(400).json({ error: 'Post is not in pending_approval state' });
    }

    await pool.query(
      `UPDATE social_media_posts
       SET status='rejected', rejection_reason=$1, updated_at=now()
       WHERE id=$2`,
      [reason.trim(), id],
    );

    return res.json({ message: 'Post rejected' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/posts/:id/retry-failed
// Retry only the platforms that failed on a partially_published or failed post
// ─────────────────────────────────────────────────────────────────────────────
router.post('/posts/:id/retry-failed', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;

    const post = await pool.query(
      `SELECT id, status, media_deleted FROM social_media_posts WHERE id=$1 AND school_id=$2`,
      [id, school_id],
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (!['partially_published', 'failed'].includes(post.rows[0].status)) {
      return res.status(400).json({ error: 'Only partially published or failed posts can be retried' });
    }
    if (post.rows[0].media_deleted) {
      return res.status(400).json({ error: 'Media files were deleted after the initial publish attempt. This post cannot be retried.' });
    }

    // Check there are actually failed platforms to retry
    const failedPlatforms = await pool.query(
      `SELECT platform FROM social_media_post_platforms WHERE post_id=$1 AND status='failed'`,
      [id],
    );
    if (!failedPlatforms.rows.length) {
      return res.status(400).json({ error: 'No failed platforms found on this post' });
    }

    // Fire async — same pattern as approve
    retryFailedPlatforms(id, school_id).catch(err =>
      console.error(`[retry-failed] Error for post ${id}:`, err),
    );

    return res.json({
      message: `Retrying ${failedPlatforms.rows.map((r: any) => r.platform).join(', ')} — check post history in a few seconds`,
    });
  } catch (err) {
    console.error('[retry-failed]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/social-media/posts/:id/platform/:platform
// Delete a published post from a specific platform (Instagram or Facebook)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/posts/:id/platform/:platform', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id, platform } = req.params;

    if (!['instagram', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Platform delete is only supported for Instagram and Facebook' });
    }

    // Get the platform_post_id stored when it was published
    const pfRow = await pool.query(
      `SELECT smpf.platform_post_id, smpf.status
       FROM social_media_post_platforms smpf
       JOIN social_media_posts smp ON smp.id = smpf.post_id
       WHERE smpf.post_id=$1 AND smpf.platform=$2 AND smp.school_id=$3`,
      [id, platform, school_id],
    );
    if (!pfRow.rows.length) return res.status(404).json({ error: 'Post/platform not found' });
    if (pfRow.rows[0].status !== 'posted') {
      return res.status(400).json({ error: `This post was not successfully published to ${platform}` });
    }

    const platformPostId = pfRow.rows[0].platform_post_id;
    if (!platformPostId) {
      return res.status(400).json({ error: `No platform post ID stored for ${platform} — cannot delete remotely` });
    }

    // Get access token for the platform
    const credRow = await pool.query(
      `SELECT access_token FROM social_media_configs WHERE school_id=$1 AND platform=$2 AND enabled=true`,
      [school_id, platform],
    );
    if (!credRow.rows.length || !credRow.rows[0].access_token) {
      return res.status(400).json({ error: `No credentials configured for ${platform}` });
    }
    const accessToken = decryptCredential(credRow.rows[0].access_token);

    // Call Graph API DELETE /{post-id}
    try {
      await axios.delete(
        `https://graph.facebook.com/v19.0/${platformPostId}`,
        { params: { access_token: accessToken }, timeout: 10000 },
      );
    } catch (apiErr: any) {
      const msg = apiErr?.response?.data?.error?.message || apiErr?.message || 'API call failed';
      console.error(`[delete-platform] ${platform} Graph API error:`, msg);
      return res.status(502).json({ error: `${platform} API error: ${msg}` });
    }

    // Mark deleted in DB
    await pool.query(
      `UPDATE social_media_post_platforms
       SET status='deleted', error_message='Deleted by admin', updated_at=now()
       WHERE post_id=$1 AND platform=$2`,
      [id, platform],
    );

    // Recalculate overall post status
    const allPf = await pool.query(
      `SELECT status FROM social_media_post_platforms WHERE post_id=$1`, [id],
    );
    const statuses: string[] = allPf.rows.map((r: any) => r.status);
    const hasPosted = statuses.some(s => s === 'posted');
    const allDeletedOrFailed = statuses.every(s => ['deleted', 'failed'].includes(s));
    const newStatus = allDeletedOrFailed ? 'deleted' : hasPosted ? 'partially_published' : 'failed';
    await pool.query(
      `UPDATE social_media_posts SET status=$1, updated_at=now() WHERE id=$2`,
      [newStatus, id],
    );

    console.log(`[delete-platform] Post ${id} deleted from ${platform} (post ID: ${platformPostId})`);
    return res.json({ message: `Post deleted from ${platform}` });
  } catch (err) {
    console.error('[delete-platform]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/social-media/drive-cleanup
// Delete Drive files for all posts submitted on or before `before_date`.
// Only deletes files from posts that are published, failed, rejected, or recalled
// (i.e. no longer pending or approved-in-progress).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/drive-cleanup', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { before_date } = req.body; // YYYY-MM-DD

    if (!before_date || !/^\d{4}-\d{2}-\d{2}$/.test(before_date)) {
      return res.status(400).json({ error: 'before_date is required (YYYY-MM-DD)' });
    }

    // Find all posts submitted on or before that date that are safe to clean
    const rows = await pool.query(
      `SELECT id, media_paths FROM social_media_posts
       WHERE school_id=$1
         AND media_deleted=false
         AND status IN ('published','partially_published','failed','rejected','recalled')
         AND submitted_at::date <= $2::date`,
      [school_id, before_date],
    );

    if (!rows.rows.length) {
      return res.json({ deleted: 0, errors: 0, message: 'No Drive files found for the selected date range.' });
    }

    let deleted = 0;
    let errors = 0;
    const { deleteDriveFile } = await import('../../lib/driveDelete');

    for (const post of rows.rows) {
      let postHadError = false;
      for (const mediaPath of post.media_paths || []) {
        if (!mediaPath.startsWith('google_drive:')) continue;
        const fileId = mediaPath.replace('google_drive:', '');
        try {
          await deleteDriveFile(fileId, school_id);
          deleted++;
        } catch (e: any) {
          console.error(`[drive-cleanup] Failed to delete ${fileId}:`, e?.message);
          errors++;
          postHadError = true;
        }
      }
      // Mark media_deleted even if some files errored — they may already be gone
      if (!postHadError) {
        await pool.query(
          `UPDATE social_media_posts SET media_deleted=true WHERE id=$1`, [post.id],
        );
      }
    }

    console.log(`[drive-cleanup] school=${school_id} before=${before_date} deleted=${deleted} errors=${errors}`);
    return res.json({
      deleted,
      errors,
      posts_processed: rows.rows.length,
      message: errors
        ? `Deleted ${deleted} file(s). ${errors} file(s) could not be deleted (may already be gone).`
        : `Deleted ${deleted} file(s) from ${rows.rows.length} post(s).`,
    });
  } catch (err) {
    console.error('[drive-cleanup]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/social-media/drive-cleanup/preview
// Count how many files would be deleted for a given before_date
// ─────────────────────────────────────────────────────────────────────────────
router.get('/drive-cleanup/preview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { before_date } = req.query as { before_date?: string };

    if (!before_date || !/^\d{4}-\d{2}-\d{2}$/.test(before_date)) {
      return res.status(400).json({ error: 'before_date query param required (YYYY-MM-DD)' });
    }

    const rows = await pool.query(
      `SELECT id, media_paths, status, submitted_at::date AS submitted_date
       FROM social_media_posts
       WHERE school_id=$1
         AND media_deleted=false
         AND status IN ('published','partially_published','failed','rejected','recalled')
         AND submitted_at::date <= $2::date
       ORDER BY submitted_at DESC`,
      [school_id, before_date],
    );

    const fileCount = rows.rows.reduce(
      (sum: number, p: any) => sum + (p.media_paths || []).filter((x: string) => x.startsWith('google_drive:')).length,
      0,
    );

    return res.json({
      posts: rows.rows.length,
      files: fileCount,
      earliest: rows.rows.length ? rows.rows[rows.rows.length - 1].submitted_date : null,
      latest: rows.rows.length ? rows.rows[0].submitted_date : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/admin/social-media/posts/:id/caption
// Edit caption before approving
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/posts/:id/caption', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { caption, hashtags } = req.body;
    await pool.query(
      `UPDATE social_media_posts SET final_caption=$1, hashtags=$2, updated_at=now()
       WHERE id=$3 AND school_id=$4 AND status='pending_approval'`,
      [caption, hashtags || [], req.params.id, school_id],
    );
    return res.json({ message: 'Caption updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
