/**
 * lib/socialMediaPublisher.ts
 * Publishes approved social media posts to configured platforms.
 * Storage: Google Drive only.
 * Files are public (reader/anyone) so Instagram/Facebook can fetch them directly
 * via https://drive.google.com/uc?export=download&id=FILE_ID
 */
import axios from 'axios';
import { pool } from './db';
import { decryptCredential, encryptCredential } from './credentialEncryption';
import { deleteDriveFile } from './driveDelete';

// ── Token auto-refresh for Meta (Instagram/Facebook) ─────────────────────────
async function tryRefreshMetaToken(schoolId: string, platform: string): Promise<string | null> {
  try {
    const row = await pool.query(
      'SELECT access_token, app_id, app_secret FROM social_media_configs WHERE school_id=$1 AND platform=$2',
      [schoolId, platform],
    );
    if (!row.rows[0]?.app_id || !row.rows[0]?.app_secret || !row.rows[0]?.access_token) return null;

    const currentToken = decryptCredential(row.rows[0].access_token);
    const appId = row.rows[0].app_id;
    const appSecret = decryptCredential(row.rows[0].app_secret);

    const r = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: currentToken },
      timeout: 10000,
    });

    const newToken = r.data?.access_token;
    if (!newToken) return null;

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query(
      `UPDATE social_media_configs SET access_token=$1, token_expires_at=$2, updated_at=now() WHERE school_id=$3 AND platform=$4`,
      [encryptCredential(newToken), expiresAt, schoolId, platform],
    );
    console.log(`[publisher] Auto-refreshed ${platform} token for school ${schoolId}, expires ${expiresAt}`);
    return newToken;
  } catch (e: any) {
    console.error(`[publisher] Token refresh failed for ${platform}:`, e?.response?.data?.error?.message || e?.message);
    return null;
  }
}

type Platform = 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'linkedin';

interface PublishResult {
  platform: Platform;
  success: boolean;
  platform_post_id?: string;
  error?: string;
}

/** Convert stored google_drive:FILE_ID path to a publicly fetchable URL */
function mediaPathToUrl(mediaPath: string): string | null {
  if (mediaPath.startsWith('google_drive:')) {
    const fileId = mediaPath.replace('google_drive:', '');
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function publishPost(postId: string, schoolId: string): Promise<void> {
  try {
    const postRow = await pool.query(
      `SELECT smp.*, smpf.platform
       FROM social_media_posts smp
       JOIN social_media_post_platforms smpf ON smpf.post_id = smp.id
       WHERE smp.id = $1 AND smp.school_id = $2`,
      [postId, schoolId],
    );
    if (!postRow.rows.length) {
      console.error(`[publisher] Post ${postId} not found`);
      return;
    }

    const post = postRow.rows[0];
    const platforms: Platform[] = [...new Set(postRow.rows.map((r: any) => r.platform as Platform))];

    // Load platform credentials
    const configRows = await pool.query(
      `SELECT platform, access_token, refresh_token, page_id, account_id, extra_config
       FROM social_media_configs
       WHERE school_id=$1 AND platform=ANY($2::text[]) AND enabled=true`,
      [schoolId, platforms],
    );
    const configs: Record<string, any> = {};
    for (const row of configRows.rows) {
      configs[row.platform] = {
        ...row,
        access_token: row.access_token ? decryptCredential(row.access_token) : null,
        refresh_token: row.refresh_token ? decryptCredential(row.refresh_token) : null,
      };
    }

    // Build direct-download URLs from Drive file IDs (files are already public)
    const mediaUrls: string[] = (post.media_paths || [])
      .map(mediaPathToUrl)
      .filter((u: string | null): u is string => u !== null);

    if (!mediaUrls.length) {
      console.error(`[publisher] No media URLs for post ${postId}`);
      await pool.query(
        `UPDATE social_media_posts SET status='failed', updated_at=now() WHERE id=$1`, [postId],
      );
      return;
    }

    const caption = post.final_caption || post.ai_caption || post.raw_caption || '';
    const hashtags: string[] = post.hashtags || [];
    const fullCaption = hashtags.length
      ? `${caption}\n\n${hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}`
      : caption;

    // Publish to all platforms in parallel
    const results: PublishResult[] = await Promise.all(
      platforms.map(async (platform) => {
        const config = configs[platform];
        if (!config?.access_token) {
          console.error(`[publisher] Post ${postId} platform=${platform}: No valid credential found`);
          return { platform, success: false, error: 'No valid credential found' };
        }
        try {
          const result = await publishToPlatform(platform, config, post, mediaUrls, fullCaption);
          if (!result.success) {
            console.error(`[publisher] Post ${postId} platform=${platform} failed:`, result.error);
            // Auto-retry with fresh token if expired
            if (result.error?.includes('OAuthException') || result.error?.includes('Session has expired')) {
              const freshToken = await tryRefreshMetaToken(schoolId, platform);
              if (freshToken) {
                console.log(`[publisher] Retrying ${platform} with fresh token...`);
                return await publishToPlatform(platform, { ...config, access_token: freshToken }, post, mediaUrls, fullCaption);
              }
            }
          }
          return result;
        } catch (err: any) {
          const errMsg = err?.response?.data ? JSON.stringify(err.response.data) : err?.message || 'Unknown error';
          console.error(`[publisher] Post ${postId} platform=${platform} threw:`, errMsg);
          // Auto-retry on auth errors
          if (errMsg.includes('OAuthException') || errMsg.includes('Session has expired')) {
            const freshToken = await tryRefreshMetaToken(schoolId, platform);
            if (freshToken) {
              try {
                return await publishToPlatform(platform, { ...config, access_token: freshToken }, post, mediaUrls, fullCaption);
              } catch (retryErr: any) {
                return { platform, success: false, error: retryErr?.response?.data ? JSON.stringify(retryErr.response.data) : retryErr?.message };
              }
            }
          }
          return { platform, success: false, error: errMsg };
        }
      }),
    );

    // Update per-platform statuses
    for (const result of results) {
      await pool.query(
        `UPDATE social_media_post_platforms
         SET status=$1, platform_post_id=$2, error_message=$3, attempted_at=now(), posted_at=$4
         WHERE post_id=$5 AND platform=$6`,
        [
          result.success ? 'posted' : 'failed',
          result.platform_post_id || null,
          result.error || null,
          result.success ? new Date().toISOString() : null,
          postId, result.platform,
        ],
      );
    }

    const successCount = results.filter(r => r.success).length;
    const finalStatus = successCount === results.length ? 'published'
      : successCount > 0 ? 'partially_published' : 'failed';

    await pool.query(
      `UPDATE social_media_posts SET status=$1, published_at=$2, updated_at=now() WHERE id=$3`,
      [finalStatus, finalStatus !== 'failed' ? new Date().toISOString() : null, postId],
    );

    // Delete from Google Drive after publishing (regardless of outcome)
    for (const mediaPath of post.media_paths || []) {
      if (mediaPath.startsWith('google_drive:')) {
        const fileId = mediaPath.replace('google_drive:', '');
        await deleteDriveFile(fileId, schoolId).catch(e =>
          console.error(`[publisher] Drive delete failed for ${fileId}:`, e?.message),
        );
      }
    }
    await pool.query(`UPDATE social_media_posts SET media_deleted=true WHERE id=$1`, [postId]);

    // Notify teacher
    const notifBody = finalStatus === 'published'
      ? 'Your social media post has been published successfully.'
      : finalStatus === 'partially_published'
        ? 'Your post was published to some platforms. Check post history for details.'
        : 'Your social media post failed to publish. The admin has been notified.';

    await pool.query(
      `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body, topic, extension)
       VALUES ($1,$2,NULL,NULL,'teacher',$3,'social_media_publish','')
       ON CONFLICT DO NOTHING`,
      [schoolId, post.teacher_id, notifBody],
    ).catch(() => {});

    console.log(`[publisher] Post ${postId} → ${finalStatus} (${successCount}/${results.length} platforms)`);
  } catch (err) {
    console.error(`[publisher] Fatal error for post ${postId}:`, err);
    await pool.query(
      `UPDATE social_media_posts SET status='failed', updated_at=now() WHERE id=$1`, [postId],
    ).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform dispatchers
// ─────────────────────────────────────────────────────────────────────────────
async function publishToPlatform(
  platform: Platform, config: any, post: any, mediaUrls: string[], caption: string,
): Promise<PublishResult> {
  switch (platform) {
    case 'instagram': return publishToInstagram(config, post, mediaUrls, caption);
    case 'facebook':  return publishToFacebook(config, post, mediaUrls, caption);
    case 'youtube':   return publishToYouTube(config, post, mediaUrls, caption);
    case 'twitter':   return publishToTwitter(config, post, mediaUrls, caption);
    case 'linkedin':  return publishToLinkedIn(config, post, mediaUrls, caption);
    default: return { platform, success: false, error: `Unknown platform: ${platform}` };
  }
}

// ── Instagram ────────────────────────────────────────────────────────────────
async function publishToInstagram(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, account_id } = config;
  const BASE = 'https://graph.facebook.com/v19.0';

  if (post.media_type === 'video') {
    const containerRes = await axios.post(`${BASE}/${account_id}/media`, {
      media_type: 'REELS', video_url: mediaUrls[0], caption, access_token,
    });
    await waitForInstagramContainer(containerRes.data.id, access_token);
    const pubRes = await axios.post(`${BASE}/${account_id}/media_publish`, {
      creation_id: containerRes.data.id, access_token,
    });
    return { platform: 'instagram', success: true, platform_post_id: pubRes.data.id };
  }

  // Image carousel
  const childIds: string[] = [];
  for (const url of mediaUrls) {
    const r = await axios.post(`${BASE}/${account_id}/media`, {
      image_url: url, is_carousel_item: true, access_token,
    });
    childIds.push(r.data.id);
  }
  const carouselRes = await axios.post(`${BASE}/${account_id}/media`, {
    media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token,
  });
  await waitForInstagramContainer(carouselRes.data.id, access_token);
  const pubRes = await axios.post(`${BASE}/${account_id}/media_publish`, {
    creation_id: carouselRes.data.id, access_token,
  });
  return { platform: 'instagram', success: true, platform_post_id: pubRes.data.id };
}

async function waitForInstagramContainer(containerId: string, token: string, maxWait = 60000): Promise<void> {
  const BASE = 'https://graph.facebook.com/v19.0';
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const r = await axios.get(`${BASE}/${containerId}?fields=status_code&access_token=${token}`);
    if (r.data.status_code === 'FINISHED') return;
    if (r.data.status_code === 'ERROR') throw new Error('Instagram container processing failed');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Instagram container processing timed out');
}

// ── Facebook ─────────────────────────────────────────────────────────────────
async function publishToFacebook(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, page_id } = config;
  const BASE = 'https://graph.facebook.com/v19.0';

  if (post.media_type === 'video') {
    const r = await axios.post(`${BASE}/${page_id}/videos`, {
      file_url: mediaUrls[0], description: caption, access_token,
    });
    return { platform: 'facebook', success: true, platform_post_id: r.data.id };
  }

  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    const r = await axios.post(`${BASE}/${page_id}/photos`, { url, published: false, access_token });
    photoIds.push(r.data.id);
  }
  const feedRes = await axios.post(`${BASE}/${page_id}/feed`, {
    message: caption,
    attached_media: photoIds.map(id => ({ media_fbid: id })),
    access_token,
  });
  return { platform: 'facebook', success: true, platform_post_id: feedRes.data.id };
}

// ── YouTube Shorts ────────────────────────────────────────────────────────────
async function publishToYouTube(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  if (post.media_type !== 'video')
    return { platform: 'youtube', success: false, error: 'YouTube only supports video posts' };

  const { access_token } = config;
  const videoRes = await axios.get(mediaUrls[0], { responseType: 'arraybuffer' });
  const videoBuffer = Buffer.from(videoRes.data);

  const initRes = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: { title: caption.substring(0, 100), description: `${caption}\n\n#Shorts`, categoryId: '27' },
      status: { privacyStatus: 'public' },
    },
    {
      headers: {
        Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': videoBuffer.length,
      },
    },
  );
  const uploadRes = await axios.put(initRes.headers.location, videoBuffer, {
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': videoBuffer.length, Authorization: `Bearer ${access_token}` },
  });
  return { platform: 'youtube', success: true, platform_post_id: uploadRes.data.id };
}

// ── Twitter / X ───────────────────────────────────────────────────────────────
async function publishToTwitter(config: any, _post: any, _mediaUrls: string[], caption: string): Promise<PublishResult> {
  const r = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text: caption.substring(0, 280) },
    { headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' } },
  );
  return { platform: 'twitter', success: true, platform_post_id: r.data.data?.id };
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
async function publishToLinkedIn(config: any, post: any, _mediaUrls: string[], caption: string): Promise<PublishResult> {
  const r = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${config.account_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: post.media_type === 'video' ? 'VIDEO' : 'IMAGE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' } },
  );
  return { platform: 'linkedin', success: true, platform_post_id: r.headers['x-restli-id'] };
}
