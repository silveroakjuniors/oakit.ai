/**
 * aiCredits.ts — AI credit wallet management
 *
 * Every AI call goes through:
 *   1. checkAndDeductCredits() — verifies balance > 0, deducts cost, logs usage
 *   2. If balance hits 0 → school is blocked, AI returns 402 Payment Required
 *
 * Costs are in PAISE (₹1 = 100 paise) to avoid floating-point issues.
 */

import { pool } from './db';
import { redis } from './redis';

// ── Cost per endpoint (paise) — used when token counts aren't available ───────
// These are the "flat per-call" costs charged to schools.
// Super-admin can override per-school via school_ai_pricing.
export const ENDPOINT_FLAT_COSTS: Record<string, number> = {
  'query':                  8,   // ₹0.08 — main teacher/parent query
  'topic-summary':          4,   // ₹0.04 — parent topic summary
  'day-highlights':         4,   // ₹0.04 — parent day highlights
  'suggest-activity':       6,   // ₹0.06 — activity suggestion
  'generate-quiz':         10,   // ₹0.10 — quiz generation
  'evaluate-quiz':          6,   // ₹0.06 — quiz evaluation
  'format-homework':        4,   // ₹0.04 — homework formatting
  'beautify-child-journey': 5,   // ₹0.05 — child journey entry
  'snapshot':               5,   // ₹0.05 — daily child snapshot
  'generate-worksheet':    12,   // ₹0.12 — worksheet generation
  'generate-report':       15,   // ₹0.15 — progress report
  'generate-plans':        20,   // ₹0.20 — monthly plan generation
  'plan-questions':         4,   // ₹0.04 — suggested questions
  'birthday-wish':          2,   // ₹0.02 — birthday message
  'format-session':         6,   // ₹0.06 — session notes
  'default':                5,   // ₹0.05 — fallback
};

// ── Cache key for wallet balance (avoid DB hit on every call) ─────────────────
function walletCacheKey(schoolId: string) {
  return `ai:wallet:${schoolId}`;
}

// ── Get cached balance (paise) — returns null if not cached ──────────────────
async function getCachedBalance(schoolId: string): Promise<number | null> {
  const v = await redis.get(walletCacheKey(schoolId));
  return v !== null ? parseInt(v, 10) : null;
}

// ── Refresh cache from DB ─────────────────────────────────────────────────────
async function refreshBalanceCache(schoolId: string): Promise<number> {
  const row = await pool.query(
    'SELECT balance_paise, blocked FROM school_ai_wallet WHERE school_id = $1',
    [schoolId]
  );
  if (row.rows.length === 0) {
    // Auto-create wallet if missing (shouldn't happen after migration)
    await pool.query(
      'INSERT INTO school_ai_wallet (school_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [schoolId]
    );
    await redis.setEx(walletCacheKey(schoolId), 60, '0');
    return 0;
  }
  const balance = row.rows[0].balance_paise as number;
  await redis.setEx(walletCacheKey(schoolId), 60, String(balance)); // cache 60s
  return balance;
}

// ── Main: check balance and deduct cost ──────────────────────────────────────
export async function checkAndDeductCredits(opts: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  endpoint: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<{ allowed: boolean; balance_paise: number; cost_paise: number }> {
  const { schoolId, actorId, actorRole, endpoint, provider, inputTokens = 0, outputTokens = 0 } = opts;

  // Get pricing config for this school
  const pricingRow = await pool.query(
    `SELECT cost_per_1k_input_paise, cost_per_1k_output_paise, flat_cost_paise,
            low_balance_threshold_paise
     FROM school_ai_pricing WHERE school_id = $1`,
    [schoolId]
  );
  const pricing = pricingRow.rows[0] || {
    cost_per_1k_input_paise: 15,
    cost_per_1k_output_paise: 60,
    flat_cost_paise: 5,
    low_balance_threshold_paise: 50000,
  };

  // Calculate cost
  let costPaise: number;
  if (inputTokens > 0 || outputTokens > 0) {
    // Token-based pricing
    costPaise = Math.ceil(
      (inputTokens / 1000) * pricing.cost_per_1k_input_paise +
      (outputTokens / 1000) * pricing.cost_per_1k_output_paise
    );
  } else {
    // Flat per-endpoint cost
    const flatBase = ENDPOINT_FLAT_COSTS[endpoint] ?? ENDPOINT_FLAT_COSTS['default'];
    costPaise = pricing.flat_cost_paise > 0 ? pricing.flat_cost_paise : flatBase;
  }
  costPaise = Math.max(costPaise, 1); // minimum 1 paise

  // Check + deduct atomically in DB
  const result = await pool.query(
    `UPDATE school_ai_wallet
     SET balance_paise       = balance_paise - $2,
         lifetime_used_paise = lifetime_used_paise + $2,
         blocked             = CASE WHEN balance_paise - $2 <= 0 THEN true ELSE false END,
         updated_at          = now()
     WHERE school_id = $1 AND balance_paise > 0
     RETURNING balance_paise, blocked`,
    [schoolId, costPaise]
  );

  if (result.rows.length === 0) {
    // Balance was already 0 or wallet doesn't exist
    await pool.query(
      `UPDATE school_ai_wallet SET blocked = true, updated_at = now() WHERE school_id = $1`,
      [schoolId]
    );
    // Log the blocked call
    await pool.query(
      `INSERT INTO ai_usage_logs
         (school_id, actor_id, actor_role, endpoint, provider, input_tokens, output_tokens, cost_paise, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,'blocked_no_credits')`,
      [schoolId, actorId, actorRole, endpoint, provider || 'none', inputTokens, outputTokens]
    );
    await redis.del(walletCacheKey(schoolId)); // invalidate cache
    return { allowed: false, balance_paise: 0, cost_paise: costPaise };
  }

  const newBalance = result.rows[0].balance_paise as number;
  const blocked = result.rows[0].blocked as boolean;

  // Invalidate cache
  await redis.setEx(walletCacheKey(schoolId), 60, String(newBalance));

  // Log usage
  await pool.query(
    `INSERT INTO ai_usage_logs
       (school_id, actor_id, actor_role, endpoint, provider, input_tokens, output_tokens, cost_paise, outcome)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'allowed')`,
    [schoolId, actorId, actorRole, endpoint, provider || 'unknown', inputTokens, outputTokens, costPaise]
  );

  // Log deduction transaction
  await pool.query(
    `INSERT INTO ai_credit_transactions
       (school_id, type, amount_paise, balance_after_paise, description, endpoint, actor_id)
     VALUES ($1,'deduction',$2,$3,$4,$5,$6)`,
    [schoolId, -costPaise, newBalance, `AI call: ${endpoint}`, endpoint, actorId]
  );

  // Low balance alert (once per threshold crossing)
  if (newBalance <= pricing.low_balance_threshold_paise && newBalance > 0) {
    const alertRow = await pool.query(
      'SELECT low_balance_alerted FROM school_ai_wallet WHERE school_id = $1',
      [schoolId]
    );
    if (!alertRow.rows[0]?.low_balance_alerted) {
      await pool.query(
        'UPDATE school_ai_wallet SET low_balance_alerted = true WHERE school_id = $1',
        [schoolId]
      );
      // Insert a notification for admin/principal
      await pool.query(
        `INSERT INTO audit_logs (school_id, actor_id, actor_role, action, entity_type, metadata)
         VALUES ($1, $2, $3, 'ai_low_balance', 'school_ai_wallet', $4)`,
        [schoolId, actorId, actorRole, JSON.stringify({
          balance_paise: newBalance,
          balance_inr: (newBalance / 100).toFixed(2),
          threshold_inr: (pricing.low_balance_threshold_paise / 100).toFixed(2),
        })]
      );
    }
  }

  return { allowed: !blocked, balance_paise: newBalance, cost_paise: costPaise };
}

// ── Recharge a school's wallet (called by super_admin) ───────────────────────
export async function rechargeWallet(opts: {
  schoolId: string;
  amountPaise: number;
  actorId: string;
  description?: string;
}): Promise<{ balance_paise: number }> {
  const { schoolId, amountPaise, actorId, description } = opts;

  const result = await pool.query(
    `INSERT INTO school_ai_wallet (school_id, balance_paise, lifetime_recharged_paise)
     VALUES ($1, $2, $2)
     ON CONFLICT (school_id) DO UPDATE
     SET balance_paise            = school_ai_wallet.balance_paise + $2,
         lifetime_recharged_paise = school_ai_wallet.lifetime_recharged_paise + $2,
         blocked                  = false,
         low_balance_alerted      = false,
         updated_at               = now()
     RETURNING balance_paise`,
    [schoolId, amountPaise]
  );

  const newBalance = result.rows[0].balance_paise as number;

  // Log transaction
  await pool.query(
    `INSERT INTO ai_credit_transactions
       (school_id, type, amount_paise, balance_after_paise, description, actor_id)
     VALUES ($1,'recharge',$2,$3,$4,$5)`,
    [schoolId, amountPaise, newBalance, description || 'Manual recharge', actorId]
  );

  await redis.setEx(walletCacheKey(schoolId), 60, String(newBalance));
  return { balance_paise: newBalance };
}

// ── Get wallet summary for a school ──────────────────────────────────────────
export async function getWalletSummary(schoolId: string) {
  const row = await pool.query(
    `SELECT w.balance_paise, w.lifetime_used_paise, w.lifetime_recharged_paise,
            w.blocked, w.low_balance_alerted, w.updated_at,
            p.cost_per_1k_input_paise, p.cost_per_1k_output_paise,
            p.flat_cost_paise, p.low_balance_threshold_paise
     FROM school_ai_wallet w
     LEFT JOIN school_ai_pricing p ON p.school_id = w.school_id
     WHERE w.school_id = $1`,
    [schoolId]
  );
  return row.rows[0] || null;
}
