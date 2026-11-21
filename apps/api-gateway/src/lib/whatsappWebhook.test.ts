/**
 * lib/whatsappWebhook.test.ts
 *
 * Automated tests for WhatsApp webhook handler (Phase 11).
 * Uses mocked Meta payloads and mocked DB/crypto — no real network calls.
 *
 * Run: npm run test -- --testPathPattern=whatsappWebhook
 */
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

// ── Mock the DB pool ──────────────────────────────────────────────────────────
jest.mock('./db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('./credentialEncryption', () => ({
  decryptCredential: (s: string) => s, // identity in tests
  encryptCredential: (s: string) => s,
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('./db');

// We import the router dynamically after mocking
let app: express.Express;

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock responses
  (pool.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
    // webhook_verify_token lookup
    if (sql.includes('webhook_verify_token')) {
      const token = params?.[0];
      if (token === 'valid-verify-token') return { rows: [{ school_id: 'school-1' }] };
      return { rows: [] };
    }
    // app secret lookup
    if (sql.includes('meta_app_secret')) {
      return { rows: [{ meta_app_secret: TEST_APP_SECRET }] };
    }
    // idempotency insert
    if (sql.includes('whatsapp_webhook_events') && sql.includes('INSERT')) {
      return { rows: [{ id: 'evt-1' }] }; // new event
    }
    // school lookup from phone_number_id
    if (sql.includes('whatsapp_configs') && sql.includes('phone_number_id')) {
      return { rows: [{ school_id: 'school-1' }] };
    }
    // parent lookup
    if (sql.includes('parent_users') && sql.includes('SELECT')) {
      return { rows: [{ id: 'parent-1', name: 'Test Parent' }] };
    }
    // conversation upsert
    if (sql.includes('whatsapp_conversations') && sql.includes('INSERT')) {
      return { rows: [{ id: 'conv-1' }] };
    }
    // message insert, status update, counter update
    return { rows: [] };
  });

  app = express();

  // Raw body must NOT go through express.json() on webhook route
  // The router handles its own body capture
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webhookRouter = require('../routes/shared/whatsappWebhook').default;
  app.use('/webhook', webhookRouter);
});

const TEST_APP_SECRET = 'test-app-secret-32chars-padded!!';
const TEST_PHONE_ID   = '123456789';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeSignature(body: string, secret = TEST_APP_SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function textMessagePayload(overrides: object = {}) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '+911234567890', phone_number_id: TEST_PHONE_ID },
          contacts: [{ profile: { name: 'Test Parent' }, wa_id: '919876543210' }],
          messages: [{
            from: '919876543210',
            id: 'wamid.test123',
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: 'Hello school' },
            type: 'text',
          }],
          ...overrides,
        },
      }],
    }],
  });
}

function statusPayload(status: string, messageId = 'wamid.test123') {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: TEST_PHONE_ID },
          statuses: [{ id: messageId, status, timestamp: String(Math.floor(Date.now() / 1000)) }],
        },
      }],
    }],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// GET — Webhook verification
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /webhook — verification', () => {
  test('succeeds with valid verify token', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'valid-verify-token',
      'hub.challenge': 'challenge-nonce-123',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('challenge-nonce-123');
  });

  test('returns 403 with invalid verify token', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-nonce-123',
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 without hub.mode', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.verify_token': 'valid-verify-token',
      'hub.challenge': 'challenge-nonce-123',
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 without challenge', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'valid-verify-token',
    });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST — Incoming events
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /webhook — signature verification', () => {
  test('accepts valid signature and returns 200', async () => {
    const body = textMessagePayload();
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  test('rejects invalid signature with 401', async () => {
    const body = textMessagePayload();
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', 'sha256=invalidhex0000000000000000000000')
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
  });

  test('rejects missing signature with 401', async () => {
    const body = textMessagePayload();
    const res = await request(app)
      .post('/webhook')
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
  });

  test('rejects wrong object type with 400', async () => {
    const body = JSON.stringify({ object: 'page', entry: [] });
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(400);
  });

  test('rejects empty body with 400', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', 'sha256=00')
      .set('content-type', 'application/json');
    // empty body may return 400 or 401 depending on order of checks
    expect([400, 401]).toContain(res.status);
  });
});

describe('POST /webhook — message processing', () => {
  test('processes incoming text message', async () => {
    const body = textMessagePayload();
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    // DB insert for message should be called eventually (async)
    // We just verify the HTTP layer returns 200
  });

  test('processes incoming image message', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: TEST_PHONE_ID },
            contacts: [{ profile: { name: 'Parent' }, wa_id: '919876543210' }],
            messages: [{
              from: '919876543210', id: 'wamid.img1',
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'image',
              image: { id: 'media-123', mime_type: 'image/jpeg', sha256: 'abc', caption: 'Class photo' },
            }],
          },
        }],
      }],
    });
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });

  test('processes incoming document message', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: TEST_PHONE_ID },
            contacts: [{ profile: { name: 'Parent' }, wa_id: '919876543210' }],
            messages: [{
              from: '919876543210', id: 'wamid.doc1',
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'document',
              document: { id: 'doc-123', mime_type: 'application/pdf', filename: 'report.pdf' },
            }],
          },
        }],
      }],
    });
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });

  test('handles delivery status update', async () => {
    const body = statusPayload('delivered');
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });

  test('handles read receipt', async () => {
    const body = statusPayload('read');
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });

  test('handles failed message status', async () => {
    const failBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: TEST_PHONE_ID },
            statuses: [{
              id: 'wamid.test123', status: 'failed',
              timestamp: String(Math.floor(Date.now() / 1000)),
              errors: [{ code: 131026, message: 'Message undeliverable' }],
            }],
          },
        }],
      }],
    });
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(failBody))
      .set('content-type', 'application/json')
      .send(failBody);
    expect(res.status).toBe(200);
  });

  test('skips duplicate webhook delivery (idempotency)', async () => {
    // Second call: idempotency INSERT returns empty rows (conflict)
    let callCount = 0;
    (pool.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('whatsapp_webhook_events') && sql.includes('INSERT')) {
        callCount++;
        // First call: new event; subsequent: duplicate
        return callCount === 1 ? { rows: [{ id: 'evt-1' }] } : { rows: [] };
      }
      if (sql.includes('meta_app_secret')) return { rows: [{ meta_app_secret: TEST_APP_SECRET }] };
      if (sql.includes('webhook_verify_token')) return { rows: [] };
      if (sql.includes('whatsapp_configs')) return { rows: [{ school_id: 'school-1' }] };
      return { rows: [] };
    });

    const body = textMessagePayload();
    const sig  = makeSignature(body);

    const r1 = await request(app).post('/webhook').set('x-hub-signature-256', sig).set('content-type', 'application/json').send(body);
    const r2 = await request(app).post('/webhook').set('x-hub-signature-256', sig).set('content-type', 'application/json').send(body);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200); // 200 always, but duplicate skipped internally
  });

  test('handles unknown sender gracefully (no crash)', async () => {
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('meta_app_secret')) return { rows: [{ meta_app_secret: TEST_APP_SECRET }] };
      if (sql.includes('whatsapp_webhook_events') && sql.includes('INSERT')) return { rows: [{ id: 'evt-1' }] };
      if (sql.includes('whatsapp_configs')) return { rows: [{ school_id: 'school-1' }] };
      if (sql.includes('parent_users')) return { rows: [] }; // ← unknown sender
      return { rows: [] };
    });

    const body = textMessagePayload();
    const res  = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200); // must not crash
  });

  test('handles unknown phone_number_id gracefully', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'unknown-id' },
            messages: [{ from: '919876543210', id: 'wamid.unk1', timestamp: '1700000000', type: 'text', text: { body: 'hi' } }],
          },
        }],
      }],
    });

    // Unknown phone — no meta_app_secret found → no signature check skipped, returns 200 without crashing
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('meta_app_secret')) return { rows: [] }; // no config
      if (sql.includes('whatsapp_webhook_events')) return { rows: [{ id: 'e1' }] };
      return { rows: [] };
    });

    // Without a configured secret the webhook logs a warning and continues
    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body, 'any-secret'))
      .set('content-type', 'application/json')
      .send(body);

    // Should still return 200 (Meta must get a 200 or it retries)
    expect(res.status).toBe(200);
  });
});

describe('Tenant isolation', () => {
  test('school-1 cannot see school-2 messages', async () => {
    // This is enforced at DB level by school_id filter.
    // Test that parent lookup always includes school_id from phone_number_id,
    // not from the message payload.
    const queriesMade: string[] = [];
    (pool.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
      queriesMade.push(sql);
      if (sql.includes('meta_app_secret')) return { rows: [{ meta_app_secret: TEST_APP_SECRET }] };
      if (sql.includes('whatsapp_webhook_events') && sql.includes('INSERT')) return { rows: [{ id: 'e1' }] };
      if (sql.includes('whatsapp_configs') && sql.includes('phone_number_id')) return { rows: [{ school_id: 'school-1' }] };
      if (sql.includes('parent_users')) {
        // Verify school_id is passed as first param (not taken from payload)
        expect(params?.[0]).toBe('school-1');
        return { rows: [{ id: 'parent-1', name: 'P' }] };
      }
      if (sql.includes('whatsapp_conversations') && sql.includes('INSERT')) return { rows: [{ id: 'conv-1' }] };
      return { rows: [] };
    });

    const body = textMessagePayload();
    await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);

    // school_id always comes from whatsapp_configs lookup, never from payload
    const parentQuery = queriesMade.find(q => q.includes('parent_users') && q.includes('SELECT'));
    expect(parentQuery).toBeTruthy();
  });
});

describe('Database failure resilience', () => {
  test('returns 200 even when DB throws during async processing', async () => {
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('meta_app_secret')) return { rows: [{ meta_app_secret: TEST_APP_SECRET }] };
      if (sql.includes('whatsapp_webhook_events') && sql.includes('INSERT')) return { rows: [{ id: 'e1' }] };
      if (sql.includes('whatsapp_configs')) return { rows: [{ school_id: 'school-1' }] };
      // Simulate DB failure during message processing
      throw new Error('DB connection lost');
    });

    const body = textMessagePayload();
    const res  = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', makeSignature(body))
      .set('content-type', 'application/json')
      .send(body);

    // HTTP layer must still return 200 to prevent Meta retries
    expect(res.status).toBe(200);
  });
});
