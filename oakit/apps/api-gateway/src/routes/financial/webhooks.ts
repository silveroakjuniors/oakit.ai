import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../../lib/db';

const router = Router();

// Raw body needed for HMAC verification — applied per-route
const rawBody = (req: Request, res: Response, next: () => void) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => { data += chunk; });
  req.on('end', () => { (req as any).rawBody = data; next(); });
};

// ── POST /razorpay ────────────────────────────────────────────────────────────
router.post('/razorpay', rawBody, async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBodyStr = (req as any).rawBody || '';

    // Verify HMAC signature
    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(rawBodyStr).digest('hex');
      if (expected !== signature) {
        console.warn('[webhook/razorpay] Signature mismatch — rejecting payload');
        await pool.query(
          `INSERT INTO audit_logs (action, module, metadata) VALUES ('webhook_rejected', 'payments', $1)`,
          [JSON.stringify({ gateway: 'razorpay', reason: 'signature_mismatch' })]
        ).catch(() => {});
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBodyStr);
    const eventType: string = event.event;
    const entity = event.payload?.payment?.entity || event.payload?.refund?.entity || {};
    const gatewayPaymentId: string = entity.id || '';

    if (eventType === 'payment.captured') {
      await pool.query(
        `UPDATE fee_payments
         SET gateway_status = 'captured', reconciled_at = now()
         WHERE gateway_payment_id = $1`,
        [gatewayPaymentId]
      );
    } else if (eventType === 'payment.failed') {
      await pool.query(
        `UPDATE fee_payments SET gateway_status = 'failed' WHERE gateway_payment_id = $1`,
        [gatewayPaymentId]
      );
      // WhatsApp notification queued via notification service (Task 19.1)
    } else if (eventType === 'refund.processed') {
      const refundAmount = parseFloat(entity.amount || '0') / 100; // Razorpay amounts in paise
      const originalPaymentId: string = entity.payment_id || '';

      // Find the original payment to get student/school context
      const paymentResult = await pool.query(
        `SELECT student_id, school_id FROM fee_payments WHERE gateway_payment_id = $1`,
        [originalPaymentId]
      );
      if (paymentResult.rows.length > 0) {
        const { student_id, school_id } = paymentResult.rows[0];
        // Reduce credit balance by refund amount (or set to 0)
        await pool.query(
          `UPDATE credit_balances
           SET amount = GREATEST(0, amount - $1), updated_at = now()
           WHERE student_id = $2 AND school_id = $3`,
          [refundAmount, student_id, school_id]
        );
      }
      await pool.query(
        `UPDATE fee_payments SET gateway_status = 'refunded' WHERE gateway_payment_id = $1`,
        [originalPaymentId]
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook/razorpay]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /phonepe ─────────────────────────────────────────────────────────────
router.post('/phonepe', rawBody, async (req, res) => {
  try {
    const saltKey = process.env.PHONEPE_SALT_KEY || '';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const xVerify = req.headers['x-verify'] as string || '';
    const rawBodyStr = (req as any).rawBody || '';

    // Verify PhonePe signature: sha256(base64payload + endpoint + saltKey) + '###' + saltIndex
    if (saltKey) {
      const endpoint = '/pg/v1/status';
      const base64Payload = Buffer.from(rawBodyStr).toString('base64');
      const hashInput = base64Payload + endpoint + saltKey;
      const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');
      const expectedVerify = `${expectedHash}###${saltIndex}`;
      if (expectedVerify !== xVerify) {
        console.warn('[webhook/phonepe] Signature mismatch — rejecting payload');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBodyStr);
    const code: string = event.code || '';
    const data = event.data || {};
    const gatewayPaymentId: string = data.transactionId || data.merchantTransactionId || '';

    if (code === 'PAYMENT_SUCCESS') {
      await pool.query(
        `UPDATE fee_payments
         SET gateway_status = 'captured', reconciled_at = now()
         WHERE gateway_payment_id = $1`,
        [gatewayPaymentId]
      );
    } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
      await pool.query(
        `UPDATE fee_payments SET gateway_status = 'failed' WHERE gateway_payment_id = $1`,
        [gatewayPaymentId]
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook/phonepe]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
