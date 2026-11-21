/**
 * lib/whatsappAutomation.ts
 * Trigger-based WhatsApp message dispatcher.
 *
 * Call these functions from existing school workflow routes to send
 * automated WhatsApp messages when configured by the admin.
 *
 * Example usage in attendance route:
 *   import { triggerWhatsApp } from '../lib/whatsappAutomation';
 *   await triggerWhatsApp(schoolId, 'attendance_absent', { parent_id, student_name, date });
 */
import { pool } from './db';
import {
  sendTemplateMessage,
  sendTextMessage,
  buildTemplateComponents,
  upsertConversation,
  persistOutboundMessage,
  normalisePhone,
} from './whatsappSender';

type TriggerType =
  | 'student_admitted'
  | 'fee_paid'
  | 'fee_overdue'
  | 'student_birthday'
  | 'attendance_absent'
  | 'attendance_late'
  | 'holiday_announced'
  | 'event_reminder'
  | 'ptm_reminder'
  | 'school_closure'
  | 'custom';

interface TriggerData {
  parent_id?: string;
  parent_ids?: string[];  // for broadcast triggers
  student_name?: string;
  student_id?: string;
  date?: string;
  amount?: string;
  event_name?: string;
  message?: string;        // override message for custom trigger
  [key: string]: any;
}

/**
 * Fire a WhatsApp automation trigger.
 * Looks up the school's configured automation for this trigger type,
 * resolves recipients, substitutes variables, and sends.
 *
 * Returns silently if WhatsApp is disabled, automation not found, or no recipients.
 */
export async function triggerWhatsApp(
  schoolId: string,
  triggerType: TriggerType,
  data: TriggerData,
): Promise<void> {
  try {
    // Check WhatsApp enabled
    const schoolRow = await pool.query(
      'SELECT whatsapp_enabled FROM schools WHERE id=$1',
      [schoolId],
    );
    if (!schoolRow.rows[0]?.whatsapp_enabled) return;

    // Load automation config
    const autoRow = await pool.query(
      `SELECT wa.*, wt.name AS template_name, wt.language AS template_language,
              wt.variable_labels, wt.body_text
       FROM whatsapp_automations wa
       LEFT JOIN whatsapp_templates wt ON wt.id=wa.template_id
       WHERE wa.school_id=$1 AND wa.trigger_type=$2 AND wa.is_active=true LIMIT 1`,
      [schoolId, triggerType],
    );
    if (!autoRow.rows[0]) return; // automation not configured for this trigger

    const automation = autoRow.rows[0];

    // Resolve parent IDs
    const parentIds: string[] = data.parent_ids?.length
      ? data.parent_ids
      : data.parent_id ? [data.parent_id] : [];

    if (!parentIds.length) return;

    // Apply delay if configured
    if (automation.delay_minutes > 0) {
      await new Promise(r => setTimeout(r, automation.delay_minutes * 60 * 1000));
    }

    for (const parentId of parentIds) {
      await sendToParent(schoolId, parentId, automation, data).catch(e =>
        console.error(`[wa-automation] Failed for parent ${parentId}:`, e?.message),
      );
    }
  } catch (err: any) {
    console.error('[wa-automation] triggerWhatsApp error:', err?.message);
    // Non-fatal — never block the main workflow
  }
}

async function sendToParent(
  schoolId: string,
  parentId: string,
  automation: any,
  data: TriggerData,
): Promise<void> {
  const parentRow = await pool.query(
    `SELECT mobile, whatsapp_phone, whatsapp_opt_in FROM parent_users
     WHERE id=$1 AND school_id=$2 AND is_active=true`,
    [parentId, schoolId],
  );
  if (!parentRow.rows[0]?.whatsapp_opt_in) return; // not opted in

  const phone = normalisePhone(parentRow.rows[0].whatsapp_phone || parentRow.rows[0].mobile);
  const convId = await upsertConversation(schoolId, parentId, phone);

  let result;
  let messageBody = '';

  if (automation.template_name && automation.template_language) {
    // Build template variables from automation.variables_map + trigger data
    const varMap: Record<string, string> = automation.variables_map || {};
    const resolvedVars = (automation.variable_labels || []).map((label: string) => {
      const dataKey = varMap[label] || label.toLowerCase().replace(/\s+/g, '_');
      return String(data[dataKey] || label);
    });

    const components = buildTemplateComponents(resolvedVars);
    result = await sendTemplateMessage(schoolId, phone, automation.template_name, automation.template_language, components);
    messageBody = automation.body_text || '';
  } else if (data.message) {
    // Custom free-form message (only valid within 24h session window)
    result = await sendTextMessage(schoolId, phone, data.message);
    messageBody = data.message;
  } else {
    return; // no message to send
  }

  await persistOutboundMessage({
    schoolId,
    conversationId: convId,
    toPhone: phone,
    fromPhone: '',
    messageType: automation.template_name ? 'template' : 'text',
    body: messageBody,
    templateName: automation.template_name,
    result,
  });
}
