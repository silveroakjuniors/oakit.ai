/**
 * routes/admin/whatsapp.ts
 * Admin + Principal WhatsApp Business management routes.
 *
 * API surface:
 *   Config:       GET/PUT /config   DELETE /config   POST /config/test   POST /config/test-message
 *   Dashboard:    GET /dashboard
 *   Inbox:        GET /conversations   GET /conversations/:id/messages
 *                 POST /conversations/:id/send   PATCH /conversations/:id/status
 *   Contacts:     GET /contacts   PATCH /contacts/:parent_id/opt-in
 *   Templates:    POST /templates/sync   GET /templates   POST /templates   DELETE /templates/:id
 *   Campaigns:    GET /campaigns   POST /campaigns   POST /campaigns/:id/send   GET /campaigns/:id/stats
 *   Automations:  GET /automations   POST /automations   PATCH /automations/:id   DELETE /automations/:id
 *   AI:           POST /ai/generate-message
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { whatsappModuleGuard } from '../../middleware/whatsappModuleGuard';
import { encryptCredential, decryptCredential } from '../../lib/credentialEncryption';
import {
  sendTextMessage, sendTemplateMessage, sendMediaMessage,
  buildTemplateComponents, upsertConversation, persistOutboundMessage, normalisePhone,
} from '../../lib/whatsappSender';
import axios from 'axios';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'), whatsappModuleGuard);

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════════

router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const row = await pool.query(
      `SELECT phone_number_id, waba_id, business_phone, display_name, meta_app_id,
              webhook_verify_token, verified, connected_at, token_expires_at,
              CASE WHEN access_token IS NOT NULL THEN true ELSE false END AS has_token
       FROM whatsapp_configs WHERE school_id=$1`,
      [school_id],
    );
    return res.json(row.rows[0] || null);
  } catch (err) {
    console.error('[wa config GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const {
      access_token, phone_number_id, waba_id, business_phone, display_name,
      meta_app_id, meta_app_secret, webhook_verify_token,
    } = req.body;

    const encToken     = access_token    ? encryptCredential(access_token)    : undefined;
    const encAppSecret = meta_app_secret ? encryptCredential(meta_app_secret) : undefined;

    await pool.query(
      `INSERT INTO whatsapp_configs
         (school_id, access_token, phone_number_id, waba_id, business_phone, display_name,
          meta_app_id, meta_app_secret, webhook_verify_token, connected_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
       ON CONFLICT (school_id) DO UPDATE SET
         access_token         = COALESCE($2, whatsapp_configs.access_token),
         phone_number_id      = COALESCE($3, whatsapp_configs.phone_number_id),
         waba_id              = COALESCE($4, whatsapp_configs.waba_id),
         business_phone       = COALESCE($5, whatsapp_configs.business_phone),
         display_name         = COALESCE($6, whatsapp_configs.display_name),
         meta_app_id          = COALESCE($7, whatsapp_configs.meta_app_id),
         meta_app_secret      = COALESCE($8, whatsapp_configs.meta_app_secret),
         webhook_verify_token = COALESCE($9, whatsapp_configs.webhook_verify_token),
         connected_at         = CASE WHEN $2 IS NOT NULL THEN now() ELSE whatsapp_configs.connected_at END,
         updated_at           = now()`,
      [school_id, encToken || null, phone_number_id || null, waba_id || null,
       business_phone || null, display_name || null, meta_app_id || null,
       encAppSecret || null, webhook_verify_token || null],
    );
    return res.json({ message: 'WhatsApp configuration saved' });
  } catch (err: any) {
    console.error('[wa config PUT]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.delete('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `UPDATE whatsapp_configs
       SET access_token=NULL, verified=false, connected_at=NULL, updated_at=now()
       WHERE school_id=$1`,
      [school_id],
    );
    return res.json({ message: 'WhatsApp disconnected' });
  } catch (err) {
    console.error('[wa config DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/config/test', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const row = await pool.query(
      `SELECT access_token, phone_number_id, waba_id FROM whatsapp_configs WHERE school_id=$1`,
      [school_id],
    );
    if (!row.rows[0]?.access_token) {
      return res.status(400).json({ success: false, error: 'No credentials configured' });
    }
    const token         = decryptCredential(row.rows[0].access_token);
    const phoneNumberId = row.rows[0].phone_number_id;

    const testRes = await axios.get(
      `https://graph.facebook.com/v20.0/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating', access_token: token },
        timeout: 10000,
      },
    );

    await pool.query(
      `UPDATE whatsapp_configs SET verified=true, updated_at=now() WHERE school_id=$1`,
      [school_id],
    );

    return res.json({
      success: true,
      display_phone_number: testRes.data.display_phone_number,
      verified_name:        testRes.data.verified_name,
      quality_rating:       testRes.data.quality_rating,
    });
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || 'Connection failed';
    return res.status(502).json({ success: false, error: msg });
  }
});

router.post('/config/test-message', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { to_phone, message } = req.body;

    if (!to_phone?.trim()) {
      return res.status(400).json({ error: 'to_phone is required (E.164 format, e.g. 919876543210)' });
    }

    const result = await sendTextMessage(
      school_id,
      normalisePhone(to_phone),
      message || 'Hello from Oakit.ai! This is a test message to confirm your WhatsApp Business integration is working correctly.',
    );

    if (result.success) {
      return res.json({ success: true, wa_message_id: result.wa_message_id, message: `Test message sent to ${to_phone}` });
    }
    return res.status(502).json({ success: false, error: result.error });
  } catch (err: any) {
    console.error('[wa config test-message]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { from, to } = req.query as { from?: string; to?: string };
    const toDate   = to   || new Date().toISOString().split('T')[0];
    const fromDate = from || (() => {
      const d = new Date(toDate);
      d.setDate(d.getDate() - 29);
      return d.toISOString().split('T')[0];
    })();

    const [msgStats, convStats, contactStats, daily, cfg] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE direction='outbound')::int                            AS sent,
           COUNT(*) FILTER (WHERE direction='inbound')::int                             AS received,
           COUNT(*) FILTER (WHERE status='delivered')::int                              AS delivered,
           COUNT(*) FILTER (WHERE status='read')::int                                   AS read_count,
           COUNT(*) FILTER (WHERE status='failed')::int                                 AS failed,
           COUNT(*) FILTER (WHERE direction='outbound' AND sent_at::date=CURRENT_DATE)::int AS sent_today
         FROM whatsapp_messages
         WHERE school_id=$1 AND sent_at BETWEEN $2::timestamptz AND $3::timestamptz + INTERVAL '1 day'`,
        [school_id, fromDate, toDate],
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='open')::int     AS active,
           COUNT(*) FILTER (WHERE status='resolved')::int AS resolved
         FROM whatsapp_conversations WHERE school_id=$1`,
        [school_id],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE whatsapp_opt_in=true)::int AS opted_in
         FROM parent_users WHERE school_id=$1 AND is_active=true`,
        [school_id],
      ),
      pool.query(
        `SELECT sent_at::date AS date,
                COUNT(*) FILTER (WHERE direction='outbound')::int AS sent,
                COUNT(*) FILTER (WHERE direction='inbound')::int  AS received
         FROM whatsapp_messages
         WHERE school_id=$1 AND sent_at >= $2::timestamptz
         GROUP BY sent_at::date ORDER BY date`,
        [school_id, fromDate],
      ),
      pool.query(
        `SELECT verified, business_phone, display_name FROM whatsapp_configs WHERE school_id=$1`,
        [school_id],
      ),
    ]);

    return res.json({
      config:        cfg.rows[0] || null,
      messages:      msgStats.rows[0],
      conversations: convStats.rows[0],
      contacts:      contactStats.rows[0],
      daily:         daily.rows,
      from:          fromDate,
      to:            toDate,
    });
  } catch (err) {
    console.error('[wa dashboard]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INBOX / CONVERSATIONS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status, search, class_id, section_id, unread } = req.query as Record<string, string>;
    const limit  = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const conditions: string[] = ['wc.school_id=$1'];
    const params: any[]        = [school_id];
    let idx = 2;

    if (status)           { conditions.push(`wc.status=$${idx++}`); params.push(status); }
    if (unread === 'true') { conditions.push(`wc.unread_count > 0`); }
    if (search) {
      conditions.push(`(pu.name ILIKE $${idx} OR wc.wa_phone ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (class_id)   { conditions.push(`c.id=$${idx++}`);   params.push(class_id); }
    if (section_id) { conditions.push(`sec.id=$${idx++}`); params.push(section_id); }

    const rows = await pool.query(
      `SELECT wc.id, wc.wa_phone, wc.status, wc.unread_count, wc.last_message_text,
              wc.last_message_at, wc.last_sender, wc.session_expires_at, wc.assigned_to,
              pu.name AS parent_name, pu.mobile AS parent_mobile,
              st.name AS student_name, sec.label AS section_label, c.name AS class_name
       FROM whatsapp_conversations wc
       JOIN parent_users pu ON pu.id = wc.parent_id
       LEFT JOIN parent_student_links psl ON psl.parent_id = pu.id
       LEFT JOIN students st ON st.id = psl.student_id
       LEFT JOIN sections sec ON sec.id = st.section_id
       LEFT JOIN classes c ON c.id = st.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY wc.last_message_at DESC NULLS LAST
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error('[wa conversations]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before as string | undefined;

    await pool.query(
      `UPDATE whatsapp_conversations SET unread_count=0, updated_at=now()
       WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );

    const rows = await pool.query(
      `SELECT wm.id, wm.wa_message_id, wm.direction, wm.message_type, wm.body,
              wm.media_url, wm.media_filename, wm.template_name, wm.status,
              wm.is_internal_note, wm.sent_at, wm.delivered_at, wm.read_at,
              u.name AS sent_by_name
       FROM whatsapp_messages wm
       LEFT JOIN users u ON u.id = wm.sent_by_user_id
       WHERE wm.conversation_id=$1 AND wm.school_id=$2
         ${before ? `AND wm.sent_at < $3::timestamptz` : ''}
       ORDER BY wm.sent_at DESC
       LIMIT ${before ? '$4' : '$3'}`,
      before
        ? [req.params.id, school_id, before, limit]
        : [req.params.id, school_id, limit],
    );
    return res.json(rows.rows.reverse());
  } catch (err) {
    console.error('[wa messages]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/conversations/:id/send', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { message, is_internal_note, media_url, media_type, media_filename } = req.body;

    const conv = await pool.query(
      `SELECT wc.id, wc.wa_phone, wc.parent_id, wc.session_expires_at, wc.school_id,
              wcc.phone_number_id
       FROM whatsapp_conversations wc
       JOIN whatsapp_configs wcc ON wcc.school_id = wc.school_id
       WHERE wc.id=$1 AND wc.school_id=$2`,
      [req.params.id, school_id],
    );
    if (!conv.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

    if (is_internal_note) {
      await pool.query(
        `INSERT INTO whatsapp_messages
           (school_id, conversation_id, wa_phone_from, wa_phone_to,
            direction, message_type, body, status, is_internal_note, sent_by_user_id)
         VALUES ($1,$2,$3,$4,'outbound','text',$5,'sent',true,$6)`,
        [school_id, req.params.id, conv.rows[0].phone_number_id, conv.rows[0].wa_phone, message, user_id],
      );
      return res.json({ message: 'Internal note saved' });
    }

    const sessionExpires = conv.rows[0].session_expires_at;
    const inSession      = sessionExpires && new Date(sessionExpires) > new Date();

    if (!inSession && !req.body.template_name) {
      return res.status(400).json({
        error: 'Outside 24-hour session window. You must use an approved template to message this parent.',
        code: 'SESSION_EXPIRED',
      });
    }

    const toPhone = normalisePhone(conv.rows[0].wa_phone);
    let result: Awaited<ReturnType<typeof sendTextMessage>>;

    if (req.body.template_name) {
      const components = buildTemplateComponents(req.body.template_vars || []);
      result = await sendTemplateMessage(school_id, toPhone, req.body.template_name, req.body.template_language || 'en', components);
    } else if (media_url && media_type) {
      result = await sendMediaMessage(school_id, toPhone, media_type, media_url, message, media_filename);
    } else {
      result = await sendTextMessage(school_id, toPhone, message);
    }

    await persistOutboundMessage({
      schoolId:       school_id,
      conversationId: req.params.id,
      toPhone,
      fromPhone:      conv.rows[0].phone_number_id,
      messageType:    req.body.template_name ? 'template' : (media_type || 'text'),
      body:           message,
      templateName:   req.body.template_name,
      sentByUserId:   user_id,
      result,
    });

    if (result.success) {
      await pool.query(
        `UPDATE whatsapp_conversations
         SET last_message_text=$1, last_message_at=now(), last_sender='school', updated_at=now()
         WHERE id=$2`,
        [message?.slice(0, 200), req.params.id],
      );
    }

    return result.success
      ? res.json({ success: true, wa_message_id: result.wa_message_id })
      : res.status(502).json({ success: false, error: result.error });
  } catch (err: any) {
    console.error('[wa send]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.patch('/conversations/:id/status', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status, assigned_to } = req.body;
    await pool.query(
      `UPDATE whatsapp_conversations
       SET status=COALESCE($1,status), assigned_to=COALESCE($2,assigned_to), updated_at=now()
       WHERE id=$3 AND school_id=$4`,
      [status || null, assigned_to || null, req.params.id, school_id],
    );
    return res.json({ message: 'Conversation updated' });
  } catch (err) {
    console.error('[wa conv status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { opted_in, class_id, section_id, role } = req.query as Record<string, string>;

    const parentConditions: string[] = ['pu.school_id=$1 AND pu.is_active=true'];
    const parentParams: any[]        = [school_id];
    let idx = 2;

    if (opted_in === 'true')  parentConditions.push('pu.whatsapp_opt_in=true');
    if (opted_in === 'false') parentConditions.push('pu.whatsapp_opt_in=false');
    if (class_id)   { parentConditions.push(`c.id=$${idx++}`);   parentParams.push(class_id); }
    if (section_id) { parentConditions.push(`sec.id=$${idx++}`); parentParams.push(section_id); }

    const parentRows = !role || role === 'parent'
      ? await pool.query(
          `SELECT DISTINCT pu.id, pu.name, pu.mobile AS phone, pu.whatsapp_phone,
                  pu.whatsapp_opt_in, pu.whatsapp_opt_in_at,
                  'parent' AS contact_role,
                  st.name AS student_name, sec.label AS section_label, c.name AS class_name
           FROM parent_users pu
           LEFT JOIN parent_student_links psl ON psl.parent_id = pu.id
           LEFT JOIN students st ON st.id = psl.student_id AND st.is_active=true
           LEFT JOIN sections sec ON sec.id = st.section_id
           LEFT JOIN classes c ON c.id = st.class_id
           WHERE ${parentConditions.join(' AND ')}
           ORDER BY pu.name`,
          parentParams,
        )
      : { rows: [] };

    const staffRows = !role || role !== 'parent'
      ? await pool.query(
          `SELECT u.id, u.name, u.mobile AS phone, NULL AS whatsapp_phone,
                  COALESCE(u.whatsapp_opt_in, false) AS whatsapp_opt_in,
                  u.whatsapp_opt_in_at,
                  r.name AS contact_role,
                  NULL AS student_name, NULL AS section_label, NULL AS class_name
           FROM users u
           JOIN roles r ON r.id = u.role_id
           WHERE u.school_id=$1 AND u.is_active=true
             AND r.name IN ('teacher','principal','admin','staff')
           ORDER BY r.name, u.name`,
          [school_id],
        )
      : { rows: [] };

    const superAdmin = {
      id:                  'super-admin-oakit',
      name:                'Oakit Super Admin',
      phone:               '919008166252',
      whatsapp_phone:      '919008166252',
      whatsapp_opt_in:     true,
      whatsapp_opt_in_at:  null,
      contact_role:        'super_admin',
      student_name:        null,
      section_label:       null,
      class_name:          null,
    };

    return res.json([superAdmin, ...staffRows.rows, ...parentRows.rows]);
  } catch (err) {
    console.error('[wa contacts]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/contacts/:parent_id/opt-in', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { opt_in } = req.body;
    await pool.query(
      `UPDATE parent_users
       SET whatsapp_opt_in=$1,
           whatsapp_opt_in_at=CASE WHEN $1=true THEN now() ELSE NULL END
       WHERE id=$2 AND school_id=$3`,
      [!!opt_in, req.params.parent_id, school_id],
    );
    return res.json({ message: `Opt-in ${opt_in ? 'enabled' : 'disabled'}` });
  } catch (err) {
    console.error('[wa opt-in]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

router.post('/templates/sync', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const credRow = await pool.query(
      `SELECT access_token, waba_id FROM whatsapp_configs WHERE school_id=$1 AND verified=true`,
      [school_id],
    );
    if (!credRow.rows[0]?.access_token || !credRow.rows[0]?.waba_id) {
      return res.status(400).json({ error: 'WhatsApp not configured or not verified' });
    }

    const token  = decryptCredential(credRow.rows[0].access_token);
    const wabaId = credRow.rows[0].waba_id;

    const metaRes = await axios.get(
      `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
      {
        params: {
          access_token: token,
          limit:        100,
          fields:       'name,status,category,language,components',
        },
        timeout: 15000,
      },
    );

    const metaTemplates: any[] = metaRes.data?.data || [];
    let synced = 0;
    let skipped = 0;

    for (const t of metaTemplates) {
      const bodyComp   = t.components?.find((c: any) => c.type === 'BODY');
      const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
      const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
      const buttonComp = t.components?.find((c: any) => c.type === 'BUTTONS');

      if (!bodyComp?.text) { skipped++; continue; }

      const varMatches     = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
      const variableLabels = varMatches.map((_: string, i: number) => `Variable ${i + 1}`);

      const statusNorm = t.status?.toLowerCase() === 'approved'
        ? 'approved'
        : t.status?.toLowerCase() === 'rejected'
          ? 'rejected'
          : 'pending';

      await pool.query(
        `INSERT INTO whatsapp_templates
           (school_id, name, display_name, category, language, body_text,
            header_text, footer_text, button_config, variable_labels,
            status, meta_template_id, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (school_id, name) DO UPDATE SET
           status           = EXCLUDED.status,
           body_text        = EXCLUDED.body_text,
           header_text      = EXCLUDED.header_text,
           footer_text      = EXCLUDED.footer_text,
           button_config    = EXCLUDED.button_config,
           variable_labels  = EXCLUDED.variable_labels,
           meta_template_id = EXCLUDED.meta_template_id,
           approved_at      = CASE WHEN EXCLUDED.status='approved' THEN now() ELSE whatsapp_templates.approved_at END,
           updated_at       = now()`,
        [
          school_id,
          t.name,
          t.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          t.category || 'UTILITY',
          t.language || 'en',
          bodyComp.text,
          headerComp?.text || null,
          footerComp?.text || null,
          buttonComp ? JSON.stringify(buttonComp.buttons) : null,
          variableLabels,
          statusNorm,
          t.id || t.name,
          statusNorm === 'approved' ? new Date() : null,
        ],
      );
      synced++;
    }

    console.log(`[wa templates sync] school=${school_id} synced=${synced} skipped=${skipped}`);
    return res.json({
      synced,
      skipped,
      total:   metaTemplates.length,
      message: `Synced ${synced} template(s) from Meta.${skipped > 0 ? ` ${skipped} skipped (no body text).` : ''}`,
    });
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || 'Sync failed';
    console.error('[wa templates sync]', msg);
    return res.status(500).json({ error: msg });
  }
});

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const rows = await pool.query(
      `SELECT id, name, display_name, category, language, status, body_text,
              header_text, footer_text, button_config, variable_labels, meta_template_id,
              approved_at, created_at
       FROM whatsapp_templates WHERE school_id=$1 ORDER BY created_at DESC`,
      [school_id],
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error('[wa templates GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { name, display_name, category, language, body_text, header_text, footer_text, button_config, variable_labels } = req.body;

    if (!name || !display_name || !body_text || !category) {
      return res.status(400).json({ error: 'name, display_name, body_text, and category are required' });
    }

    const row = await pool.query(
      `INSERT INTO whatsapp_templates
         (school_id, name, display_name, category, language, body_text,
          header_text, footer_text, button_config, variable_labels, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        school_id,
        name.toLowerCase().replace(/\s+/g, '_'),
        display_name,
        category,
        language || 'en',
        body_text,
        header_text || null,
        footer_text || null,
        button_config ? JSON.stringify(button_config) : null,
        variable_labels || [],
        user_id,
      ],
    );
    return res.status(201).json({
      id:      row.rows[0].id,
      message: 'Template saved. Submit to Meta for approval from the template detail page.',
    });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A template with that name already exists.' });
    console.error('[wa templates POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `DELETE FROM whatsapp_templates WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('[wa templates DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const rows = await pool.query(
      `SELECT wc.id, wc.name, wc.description, wc.target_type, wc.status,
              wc.total_recipients, wc.sent_count, wc.delivered_count, wc.read_count, wc.failed_count,
              wc.scheduled_at, wc.started_at, wc.completed_at, wc.created_at,
              wt.display_name AS template_name,
              u.name AS created_by_name
       FROM whatsapp_campaigns wc
       LEFT JOIN whatsapp_templates wt ON wt.id = wc.template_id
       LEFT JOIN users u ON u.id = wc.created_by
       WHERE wc.school_id=$1
       ORDER BY wc.created_at DESC`,
      [school_id],
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error('[wa campaigns GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const {
      name, description, template_id, target_type, target_class_ids, target_section_ids,
      target_parent_ids, message_body, template_vars, media_url, media_type, scheduled_at,
    } = req.body;

    if (!name || !target_type) return res.status(400).json({ error: 'name and target_type are required' });

    const row = await pool.query(
      `INSERT INTO whatsapp_campaigns
         (school_id, name, description, template_id, target_type, target_class_ids,
          target_section_ids, target_parent_ids, message_body, template_vars,
          media_url, media_type, status, scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        school_id,
        name,
        description || null,
        template_id || null,
        target_type,
        target_class_ids   || null,
        target_section_ids || null,
        target_parent_ids  || null,
        message_body || null,
        template_vars ? JSON.stringify(template_vars) : null,
        media_url  || null,
        media_type || null,
        scheduled_at ? 'scheduled' : 'draft',
        scheduled_at || null,
        user_id,
      ],
    );
    return res.status(201).json({ id: row.rows[0].id, message: 'Campaign created' });
  } catch (err) {
    console.error('[wa campaigns POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/campaigns/:id/send', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const campaignRow = await pool.query(
      `SELECT * FROM whatsapp_campaigns WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );
    if (!campaignRow.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignRow.rows[0];

    if (!['draft', 'scheduled', 'failed'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot send a campaign with status "${campaign.status}"` });
    }

    let parentQuery    = '';
    const parentParams: any[] = [school_id];

    if (campaign.target_type === 'all') {
      parentQuery = `SELECT DISTINCT pu.id, pu.mobile, pu.whatsapp_phone, pu.whatsapp_opt_in
                     FROM parent_users pu
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=true`;
    } else if (campaign.target_type === 'class' && campaign.target_class_ids?.length) {
      parentQuery = `SELECT DISTINCT pu.id, pu.mobile, pu.whatsapp_phone, pu.whatsapp_opt_in
                     FROM parent_users pu
                     JOIN parent_student_links psl ON psl.parent_id=pu.id
                     JOIN students s ON s.id=psl.student_id AND s.is_active=true
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=true
                       AND s.class_id=ANY($2::uuid[])`;
      parentParams.push(campaign.target_class_ids);
    } else if (campaign.target_type === 'section' && campaign.target_section_ids?.length) {
      parentQuery = `SELECT DISTINCT pu.id, pu.mobile, pu.whatsapp_phone, pu.whatsapp_opt_in
                     FROM parent_users pu
                     JOIN parent_student_links psl ON psl.parent_id=pu.id
                     JOIN students s ON s.id=psl.student_id AND s.is_active=true
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=true
                       AND s.section_id=ANY($2::uuid[])`;
      parentParams.push(campaign.target_section_ids);
    } else if (campaign.target_type === 'custom' && campaign.target_parent_ids?.length) {
      parentQuery = `SELECT DISTINCT pu.id, pu.mobile, pu.whatsapp_phone, pu.whatsapp_opt_in
                     FROM parent_users pu
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=true
                       AND pu.id=ANY($2::uuid[])`;
      parentParams.push(campaign.target_parent_ids);
    } else {
      return res.status(400).json({ error: 'Invalid target configuration' });
    }

    const parents = (await pool.query(parentQuery, parentParams)).rows;
    if (!parents.length) return res.status(400).json({ error: 'No opted-in recipients found for this target' });

    await pool.query(
      `UPDATE whatsapp_campaigns
       SET status='running', started_at=now(), total_recipients=$1, updated_at=now()
       WHERE id=$2`,
      [parents.length, req.params.id],
    );

    for (const parent of parents) {
      const phone = normalisePhone(parent.whatsapp_phone || parent.mobile);
      await pool.query(
        `INSERT INTO whatsapp_campaign_recipients (campaign_id, school_id, parent_id, wa_phone)
         VALUES ($1,$2,$3,$4) ON CONFLICT (campaign_id, parent_id) DO NOTHING`,
        [req.params.id, school_id, parent.id, phone],
      ).catch(() => {});
    }

    res.json({ message: `Sending to ${parents.length} recipients`, total: parents.length });

    const campaignId = req.params.id;
    setImmediate(async () => {
      let sent   = 0;
      let failed = 0;

      let template: any = null;
      if (campaign.template_id) {
        const tRow = await pool.query(
          `SELECT name, language, variable_labels FROM whatsapp_templates WHERE id=$1`,
          [campaign.template_id],
        );
        template = tRow.rows[0];
      }

      for (const parent of parents) {
        await new Promise(r => setTimeout(r, 100));
        const phone  = normalisePhone(parent.whatsapp_phone || parent.mobile);
        const convId = await upsertConversation(school_id, parent.id, phone).catch(() => null);
        if (!convId) { failed++; continue; }

        let result: Awaited<ReturnType<typeof sendTextMessage>>;
        if (template) {
          const components = buildTemplateComponents(
            Object.values(campaign.template_vars || {}) as string[],
          );
          result = await sendTemplateMessage(school_id, phone, template.name, template.language || 'en', components);
        } else {
          result = await sendTextMessage(school_id, phone, campaign.message_body || '');
        }

        const msgId = await persistOutboundMessage({
          schoolId:       school_id,
          conversationId: convId,
          toPhone:        phone,
          fromPhone:      '',
          messageType:    template ? 'template' : 'text',
          body:           campaign.message_body || '',
          templateName:   template?.name,
          campaignId,
          result,
        }).catch(() => '');

        await pool.query(
          `UPDATE whatsapp_campaign_recipients
           SET status=$1, message_id=$2, error_message=$3, sent_at=now()
           WHERE campaign_id=$4 AND parent_id=$5`,
          [result.success ? 'sent' : 'failed', msgId || null, result.error || null, campaignId, parent.id],
        ).catch(() => {});

        result.success ? sent++ : failed++;
      }

      await pool.query(
        `UPDATE whatsapp_campaigns
         SET status=$1, completed_at=now(), sent_count=$2, failed_count=$3, updated_at=now()
         WHERE id=$4`,
        [failed === parents.length ? 'failed' : 'completed', sent, failed, campaignId],
      ).catch(() => {});
    });

  } catch (err: any) {
    console.error('[wa campaign send]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.get('/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const camp = await pool.query(
      `SELECT wc.*, wt.display_name AS template_display_name
       FROM whatsapp_campaigns wc
       LEFT JOIN whatsapp_templates wt ON wt.id=wc.template_id
       WHERE wc.id=$1 AND wc.school_id=$2`,
      [req.params.id, school_id],
    );
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const recipients = await pool.query(
      `SELECT wcr.status, COUNT(*)::int AS count
       FROM whatsapp_campaign_recipients wcr
       WHERE wcr.campaign_id=$1
       GROUP BY wcr.status`,
      [req.params.id],
    );

    return res.json({ campaign: camp.rows[0], by_status: recipients.rows });
  } catch (err) {
    console.error('[wa campaign stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTOMATIONS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/automations', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const rows = await pool.query(
      `SELECT wa.id, wa.name, wa.trigger_type, wa.is_active, wa.delay_minutes, wa.variables_map,
              wt.display_name AS template_name
       FROM whatsapp_automations wa
       LEFT JOIN whatsapp_templates wt ON wt.id=wa.template_id
       WHERE wa.school_id=$1 ORDER BY wa.trigger_type`,
      [school_id],
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error('[wa automations GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/automations', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { name, trigger_type, template_id, is_active, delay_minutes, variables_map } = req.body;
    if (!name || !trigger_type) return res.status(400).json({ error: 'name and trigger_type required' });

    const row = await pool.query(
      `INSERT INTO whatsapp_automations
         (school_id, name, trigger_type, template_id, is_active, delay_minutes, variables_map, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (school_id, trigger_type) DO UPDATE
         SET name=$2, template_id=$4, is_active=$5, delay_minutes=$6, variables_map=$7, updated_at=now()
       RETURNING id`,
      [
        school_id,
        name,
        trigger_type,
        template_id || null,
        is_active !== false,
        delay_minutes || 0,
        variables_map ? JSON.stringify(variables_map) : null,
        user_id,
      ],
    );
    return res.status(201).json({ id: row.rows[0].id, message: 'Automation saved' });
  } catch (err) {
    console.error('[wa automations POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/automations/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { is_active, template_id, delay_minutes, variables_map } = req.body;
    await pool.query(
      `UPDATE whatsapp_automations
       SET is_active=COALESCE($1,is_active),
           template_id=COALESCE($2,template_id),
           delay_minutes=COALESCE($3,delay_minutes),
           variables_map=COALESCE($4,variables_map),
           updated_at=now()
       WHERE id=$5 AND school_id=$6`,
      [
        is_active  ?? null,
        template_id   || null,
        delay_minutes ?? null,
        variables_map ? JSON.stringify(variables_map) : null,
        req.params.id,
        school_id,
      ],
    );
    return res.json({ message: 'Automation updated' });
  } catch (err) {
    console.error('[wa automations PATCH]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/automations/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `DELETE FROM whatsapp_automations WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );
    return res.json({ message: 'Automation deleted' });
  } catch (err) {
    console.error('[wa automations DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// OPT-IN REPORT + REMINDERS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/whatsapp/optin-report?class_id=&opted_in=false
router.get('/optin-report', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, opted_in } = req.query as Record<string, string>;

    // ── Parent opt-in by class ────────────────────────────────────────────────
    const parentConditions: string[] = ['pu.school_id=$1 AND pu.is_active=true'];
    const parentParams: any[]        = [school_id];
    let idx = 2;
    if (opted_in === 'true')  parentConditions.push('pu.whatsapp_opt_in=true');
    if (opted_in === 'false') parentConditions.push('pu.whatsapp_opt_in=false');
    if (class_id) { parentConditions.push(`c.id=$${idx++}`); parentParams.push(class_id); }

    const parentByClass = await pool.query(
      `SELECT
         c.name AS class_name, c.id AS class_id,
         COUNT(DISTINCT pu.id)::int                                           AS total_parents,
         COUNT(DISTINCT pu.id) FILTER (WHERE pu.whatsapp_opt_in=true)::int   AS opted_in,
         COUNT(DISTINCT pu.id) FILTER (WHERE pu.whatsapp_opt_in=false)::int  AS not_opted_in,
         ROUND(
           COUNT(DISTINCT pu.id) FILTER (WHERE pu.whatsapp_opt_in=true) * 100.0
           / NULLIF(COUNT(DISTINCT pu.id), 0), 1
         ) AS opt_in_pct
       FROM parent_users pu
       JOIN parent_student_links psl ON psl.parent_id = pu.id
       JOIN students st ON st.id = psl.student_id AND st.is_active=true
       JOIN classes c ON c.id = st.class_id
       WHERE ${parentConditions.join(' AND ')}
       GROUP BY c.id, c.name ORDER BY c.name`,
      parentParams,
    );

    // ── Staff/teacher opt-in by role ──────────────────────────────────────────
    const staffByRole = await pool.query(
      `SELECT
         r.name AS role,
         COUNT(*)::int                                        AS total_staff,
         COUNT(*) FILTER (WHERE u.whatsapp_opt_in=true)::int  AS opted_in,
         COUNT(*) FILTER (WHERE u.whatsapp_opt_in=false OR u.whatsapp_opt_in IS NULL)::int AS not_opted_in,
         ROUND(
           COUNT(*) FILTER (WHERE u.whatsapp_opt_in=true) * 100.0
           / NULLIF(COUNT(*), 0), 1
         ) AS opt_in_pct
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.school_id=$1 AND u.is_active=true
         AND r.name IN ('teacher','principal','admin','staff')
       GROUP BY r.name ORDER BY r.name`,
      [school_id],
    );

    // ── Not opted-in detail lists ─────────────────────────────────────────────
    const parentNotIn = await pool.query(
      `SELECT DISTINCT pu.id, pu.name, pu.mobile, pu.whatsapp_opt_in,
              c.name AS class_name, c.id AS class_id
       FROM parent_users pu
       JOIN parent_student_links psl ON psl.parent_id = pu.id
       JOIN students st ON st.id = psl.student_id AND st.is_active=true
       JOIN classes c ON c.id = st.class_id
       WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=false
         ${class_id ? `AND c.id=$2` : ''}
       ORDER BY c.name, pu.name`,
      class_id ? [school_id, class_id] : [school_id],
    );

    const staffNotIn = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.whatsapp_opt_in, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.school_id=$1 AND u.is_active=true
         AND r.name IN ('teacher','principal','admin','staff')
         AND (u.whatsapp_opt_in=false OR u.whatsapp_opt_in IS NULL)
       ORDER BY r.name, u.name`,
      [school_id],
    );

    return res.json({
      by_class:        parentByClass.rows,
      staff_by_role:   staffByRole.rows,
      not_opted_in:    parentNotIn.rows,
      staff_not_opted_in: staffNotIn.rows,
    });
  } catch (err) {
    console.error('[wa optin-report]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/whatsapp/optin-report/send-staff-reminder
// Send WhatsApp opt-in reminder to staff who haven't opted in
router.post('/optin-report/send-staff-reminder', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { user_ids, role, message } = req.body;

    const credRow = await pool.query(
      `SELECT wc.business_phone, wc.display_name, wc.verified
       FROM whatsapp_configs wc WHERE school_id=$1 AND verified=true`,
      [school_id],
    );
    if (!credRow.rows[0]) return res.status(400).json({ error: 'WhatsApp not configured or not verified' });

    const displayName   = credRow.rows[0].display_name || 'Silver Oak Juniors';
    const businessPhone = credRow.rows[0].business_phone || '';

    let targetQuery = '';
    const targetParams: any[] = [school_id];

    if (user_ids?.length) {
      targetQuery = `SELECT u.id, u.name, u.mobile, u.whatsapp_phone FROM users u
                     JOIN roles r ON r.id = u.role_id
                     WHERE u.school_id=$1 AND u.is_active=true
                       AND (u.whatsapp_opt_in=false OR u.whatsapp_opt_in IS NULL)
                       AND u.id=ANY($2::uuid[])`;
      targetParams.push(user_ids);
    } else if (role) {
      targetQuery = `SELECT u.id, u.name, u.mobile, u.whatsapp_phone FROM users u
                     JOIN roles r ON r.id = u.role_id
                     WHERE u.school_id=$1 AND u.is_active=true
                       AND (u.whatsapp_opt_in=false OR u.whatsapp_opt_in IS NULL)
                       AND r.name=$2`;
      targetParams.push(role);
    } else {
      targetQuery = `SELECT u.id, u.name, u.mobile, u.whatsapp_phone FROM users u
                     JOIN roles r ON r.id = u.role_id
                     WHERE u.school_id=$1 AND u.is_active=true
                       AND (u.whatsapp_opt_in=false OR u.whatsapp_opt_in IS NULL)
                       AND r.name IN ('teacher','principal','admin','staff')`;
    }

    const staff = (await pool.query(targetQuery, targetParams)).rows;
    if (!staff.length) return res.json({ sent: 0, message: 'All staff have already opted in.' });

    const reminderText = message || `Hi! This is ${displayName}.\n\nWe are now on WhatsApp Business! Save this number and reply YES to receive:\n- School announcements\n- Leave approval status\n- Payslip notifications\n- Important circulars\n\nReply YES to subscribe.\n\n- ${displayName} Admin`;

    let sent = 0; let failed = 0;
    for (const user of staff) {
      await new Promise(r => setTimeout(r, 120));
      const phone = (user.whatsapp_phone || user.mobile || '').replace(/[^0-9]/g, '');
      if (!phone) { failed++; continue; }

      const { sendTextMessage, normalisePhone } = await import('../../lib/whatsappSender');
      const result = await sendTextMessage(school_id, normalisePhone(phone), reminderText);
      result.success ? sent++ : failed++;
    }

    return res.json({
      sent, failed, total: staff.length,
      message: `Reminder sent to ${sent} staff member(s).${failed > 0 ? ` ${failed} could not be delivered.` : ''}`,
    });
  } catch (err: any) {
    console.error('[wa staff-reminder]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});
// Send WhatsApp opt-in reminder to parents who haven't opted in
// Body: { parent_ids?: string[], class_id?: string, message?: string }
router.post('/optin-report/send-reminder', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { parent_ids, class_id, message } = req.body;

    // Check WhatsApp is configured
    const credRow = await pool.query(
      `SELECT wc.business_phone, wc.display_name, wc.verified
       FROM whatsapp_configs wc WHERE school_id=$1 AND verified=true`,
      [school_id],
    );
    if (!credRow.rows[0]) {
      return res.status(400).json({ error: 'WhatsApp not configured or not verified' });
    }

    const displayName   = credRow.rows[0].display_name || 'Silver Oak Juniors';
    const businessPhone = credRow.rows[0].business_phone || '';

    // Resolve target parents (not opted in)
    let targetQuery = '';
    const targetParams: any[] = [school_id];

    if (parent_ids?.length) {
      targetQuery = `SELECT DISTINCT pu.id, pu.mobile FROM parent_users pu
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=false
                       AND pu.id=ANY($2::uuid[])`;
      targetParams.push(parent_ids);
    } else if (class_id) {
      targetQuery = `SELECT DISTINCT pu.id, pu.mobile FROM parent_users pu
                     JOIN parent_student_links psl ON psl.parent_id=pu.id
                     JOIN students st ON st.id=psl.student_id AND st.is_active=true
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=false
                       AND st.class_id=$2`;
      targetParams.push(class_id);
    } else {
      targetQuery = `SELECT DISTINCT pu.id, pu.mobile FROM parent_users pu
                     WHERE pu.school_id=$1 AND pu.is_active=true AND pu.whatsapp_opt_in=false`;
    }

    const parents = (await pool.query(targetQuery, targetParams)).rows;
    if (!parents.length) return res.json({ sent: 0, message: 'All parents in this group have already opted in.' });

    const reminderText = message || `Hello! This is ${displayName}.\n\nWe are now on WhatsApp Business! Please reply YES to this number (${businessPhone}) to opt-in and receive:\n- Daily attendance updates\n- Homework notifications\n- School announcements\n- Fee reminders\n- Important circulars\n\nReply YES to subscribe. Reply NO to decline.\n\n- Team ${displayName}`;

    let sent = 0; let failed = 0;
    for (const parent of parents) {
      await new Promise(r => setTimeout(r, 120)); // rate limit
      const phone = parent.mobile.replace(/[^0-9]/g, '');
      if (!phone) { failed++; continue; }

      const { sendTextMessage, normalisePhone } = await import('../../lib/whatsappSender');
      const result = await sendTextMessage(school_id, normalisePhone(phone), reminderText);
      result.success ? sent++ : failed++;
    }

    console.log(`[wa optin-reminder] school=${school_id} sent=${sent} failed=${failed}`);
    return res.json({
      sent,
      failed,
      total: parents.length,
      message: `Reminder sent to ${sent} parent(s).${failed > 0 ? ` ${failed} could not be delivered.` : ''}`,
    });
  } catch (err: any) {
    console.error('[wa optin-reminder]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AI MESSAGE GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

router.post('/ai/generate-message', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { instruction, audience, message_type } = req.body;
    if (!instruction?.trim()) return res.status(400).json({ error: 'instruction is required' });

    const schoolRow  = await pool.query('SELECT name FROM schools WHERE id=$1', [school_id]);
    const schoolName = schoolRow.rows[0]?.name || 'the school';

    const prompt = `You are a school communication manager for "${schoolName}" preschool.
Write a professional WhatsApp message based on this instruction:

Instruction: ${instruction}
Audience: ${audience || 'Parents'}
Message type: ${message_type || 'general notification'}

Requirements:
- Keep it under 300 characters for WhatsApp readability
- Warm, friendly, and professional tone
- No emojis (school policy)
- Include the school name naturally
- Clear call to action if relevant
- Write in English

Respond ONLY with the message text, no labels or explanation.`;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiRes  = await fetch(`${AI_URL}/internal/generate-report`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt, student_name: schoolName, structured: false }),
      signal:  AbortSignal.timeout(25000),
    });
    const aiData = await aiRes.json() as any;
    const message = (aiData?.response || '').trim().replace(/^["']|["']$/g, '');

    if (!message) {
      return res.status(500).json({ error: 'AI could not generate message. Please write one manually.' });
    }
    return res.json({ message });
  } catch (err: any) {
    console.error('[wa ai generate]', err);
    return res.status(500).json({ error: 'Message generation failed. Please write one manually.' });
  }
});

export default router;
