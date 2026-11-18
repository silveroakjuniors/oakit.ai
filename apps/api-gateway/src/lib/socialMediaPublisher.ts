/**
 * lib/socialMediaPublisher.ts
 * Publishes approved social media posts to configured platforms.
 * Called after admin approves a post.
 */
import axios from 'axios';
import { pool } from './db';
import { decryptCredential } from './credentialEncryption';
import { getSignedUrl, deleteFile } from './storage';

type Platform = 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'linkedin';

interface PublishResult {
  platform: Platform;
  success: boolean;
  platform_post_id?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function publishPost(postId: string, schoolId: string): Promise<void> {
  try {
    // Load post details
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

    // Load configs for all platforms
    const configRows = await pool.query(
      `SELECT platform, access_token, refresh_token, page_id, account_id, extra_config
       FROM social_media_configs
       WHERE school_id = $1 AND platform = ANY($2::text[]) AND enabled = true`,
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

    // Get signed URLs for all media files
    const mediaUrls: string[] = [];
    for (const path of post.media_paths || []) {
      try {
        const url = await getSignedUrl(path, 3600); // 1 hour signed URL
        if (url) mediaUrls.push(url);
      } catch { /* skip failed */ }
    }

    const caption = post.final_caption || post.ai_caption || post.raw_caption || '';
    const hashtags: string[] = post.hashtags || [];
    const fullCaption = hashtags.length
      ? `${caption}\n\n${hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}`
      : caption;

    // Publish to each platform in parallel
    const results: PublishResult[] = await Promise.all(
      platforms.map(async (platform) => {
        const config = configs[platform];
        if (!config?.access_token) {
          return { platform, success: false, error: 'No valid credential found' };
        }
        try {
          return await publishToPlatform(platform, config, post, mediaUrls, fullCaption);
        } catch (err: any) {
          return { platform, success: false, error: err?.message || 'Unknown error' };
        }
      }),
    );

    // Update per-platform statuses
    for (const result of results) {
      await pool.query(
        `UPDATE social_media_post_platforms
         SET status = $1, platform_post_id = $2, error_message = $3, attempted_at = now(),
             posted_at = $4
         WHERE post_id = $5 AND platform = $6`,
        [
          result.success ? 'posted' : 'failed',
          result.platform_post_id || null,
          result.error || null,
          result.success ? new Date().toISOString() : null,
          postId,
          result.platform,
        ],
      );
    }

    // Determine overall post status
    const successCount = results.filter(r => r.success).length;
    const finalStatus = successCount === results.length
      ? 'published'
      : successCount > 0
        ? 'partially_published'
        : 'failed';

    await pool.query(
      `UPDATE social_media_posts
       SET status = $1, published_at = $2, updated_at = now()
       WHERE id = $3`,
      [finalStatus, finalStatus !== 'failed' ? new Date().toISOString() : null, postId],
    );

    // Delete media from Supabase regardless of outcome
    for (const path of post.media_paths || []) {
      try { await deleteFile(path); } catch (e) {
        console.error(`[publisher] Failed to delete media ${path}:`, e);
      }
    }
    await pool.query(
      `UPDATE social_media_posts SET media_deleted = true WHERE id = $1`,
      [postId],
    );

    // Notify teacher
    const notifBody = finalStatus === 'published'
      ? `Your social media post has been published successfully.`
      : finalStatus === 'partially_published'
        ? `Your social media post was published to some platforms. Check post history for details.`
        : `Your social media post failed to publish. The admin has been notified.`;

    await pool.query(
      `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body, topic, extension)
       VALUES ($1, $2, NULL, NULL, 'teacher', $3, 'social_media_publish', '')
       ON CONFLICT DO NOTHING`,
      [schoolId, post.teacher_id, notifBody],
    ).catch(() => {/* message table may not support null parent_id — ignore */});

    console.log(`[publisher] Post ${postId} → ${finalStatus} (${successCount}/${results.length} platforms)`);
  } catch (err) {
    console.error(`[publisher] Fatal error for post ${postId}:`, err);
    await pool.query(
      `UPDATE social_media_posts SET status = 'failed', updated_at = now() WHERE id = $1`,
      [postId],
    ).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform dispatchers
// ─────────────────────────────────────────────────────────────────────────────
async function publishToPlatform(
  platform: Platform,
  config: any,
  post: any,
  mediaUrls: string[],
  caption: string,
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

// ── Instagram (Meta Graph API) ───────────────────────────────────────────────
async function publishToInstagram(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, account_id } = config;
  const BASE = 'https://graph.facebook.com/v19.0';

  if (post.media_type === 'video') {
    // Step 1: Create video container
    const containerRes = await axios.post(`${BASE}/${account_id}/media`, {
      media_type: 'REELS',
      video_url: mediaUrls[0],
      caption,
      access_token,
    });
    const containerId = containerRes.data.id;

    // Step 2: Wait for processing then publish
    await waitForInstagramContainer(containerId, access_token);

    const publishRes = await axios.post(`${BASE}/${account_id}/media_publish`, {
      creation_id: containerId,
      access_token,
    });
    return { platform: 'instagram', success: true, platform_post_id: publishRes.data.id };
  }

  // Image carousel
  const childIds: string[] = [];
  for (const url of mediaUrls) {
    const r = await axios.post(`${BASE}/${account_id}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token,
    });
    childIds.push(r.data.id);
  }
  const carouselRes = await axios.post(`${BASE}/${account_id}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token,
  });
  await waitForInstagramContainer(carouselRes.data.id, access_token);
  const pubRes = await axios.post(`${BASE}/${account_id}/media_publish`, {
    creation_id: carouselRes.data.id,
    access_token,
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

// ── Facebook (Meta Graph API) ────────────────────────────────────────────────
async function publishToFacebook(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, page_id } = config;
  const BASE = 'https://graph.facebook.com/v19.0';

  if (post.media_type === 'video') {
    const r = await axios.post(`${BASE}/${page_id}/videos`, {
      file_url: mediaUrls[0],
      description: caption,
      access_token,
    });
    return { platform: 'facebook', success: true, platform_post_id: r.data.id };
  }

  // Photos — post as a multi-photo post
  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    const r = await axios.post(`${BASE}/${page_id}/photos`, {
      url,
      published: false,
      access_token,
    });
    photoIds.push(r.data.id);
  }
  const feedRes = await axios.post(`${BASE}/${page_id}/feed`, {
    message: caption,
    attached_media: photoIds.map(id => ({ media_fbid: id })),
    access_token,
  });
  return { platform: 'facebook', success: true, platform_post_id: feedRes.data.id };
}

// ── YouTube Shorts (YouTube Data API v3) ─────────────────────────────────────
async function publishToYouTube(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  if (post.media_type !== 'video') {
    return { platform: 'youtube', success: false, error: 'YouTube only supports video posts' };
  }
  const { access_token } = config;

  // Download video from signed URL and re-upload to YouTube
  const videoRes = await axios.get(mediaUrls[0], { responseType: 'arraybuffer' });
  const videoBuffer = Buffer.from(videoRes.data);

  // YouTube resumable upload
  const initRes = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: {
        title: caption.substring(0, 100),
        description: `${caption}\n\n#Shorts`,
        tags: [],
        categoryId: '27', // Education
      },
      status: { privacyStatus: 'public' },
    },
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': videoBuffer.length,
      },
    },
  );

  const uploadUrl = initRes.headers.location;
  const uploadRes = await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length,
      Authorization: `Bearer ${access_token}`,
    },
  });
  return { platform: 'youtube', success: true, platform_post_id: uploadRes.data.id };
}

// ── Twitter / X (API v2) ─────────────────────────────────────────────────────
async function publishToTwitter(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, extra_config } = config;
  const tweetText = caption.substring(0, 280);

  // For media, we'd need OAuth 1.0a media upload — simplified here
  const r = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text: tweetText },
    { headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' } },
  );
  return { platform: 'twitter', success: true, platform_post_id: r.data.data?.id };
}

// ── LinkedIn (Share API) ─────────────────────────────────────────────────────
async function publishToLinkedIn(config: any, post: any, mediaUrls: string[], caption: string): Promise<PublishResult> {
  const { access_token, account_id } = config; // account_id = LinkedIn person URN

  const r = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${account_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: post.media_type === 'video' ? 'VIDEO' : 'IMAGE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' } },
  );
  return { platform: 'linkedin', success: true, platform_post_id: r.headers['x-restli-id'] };
}
