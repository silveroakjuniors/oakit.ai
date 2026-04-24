jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../lib/redis', () => ({ redis: { sIsMember: jest.fn().mockResolvedValue(false) } }));

import { pool } from '../../lib/db';
import flagsRouter from './flags';
import plansRouter from './plans';
import { signToken } from '../../lib/jwt';
import express from 'express';
import http from 'http';

const mockQuery = pool.query as jest.Mock;

const SCHOOL_A = 'school-a-uuid';
const SCHOOL_B = 'school-b-uuid';
const SECTION_A = 'section-a-uuid';
const USER_ID = 'user-uuid';

const principalToken = signToken({ user_id: USER_ID, school_id: SCHOOL_A, role: 'principal', permissions: [] });

const app = express();
app.use(express.json());
app.use('/flags', flagsRouter);
app.use('/plans', plansRouter);

function call(method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as any).port;
      const data = body ? JSON.stringify(body) : '';
      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${principalToken}`,
        },
      };
      const r = http.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode!, body: JSON.parse(raw) });
        });
      });
      if (data) r.write(data);
      r.end();
    });
  });
}

beforeEach(() => mockQuery.mockReset());

describe('Principal plans — cross-school returns 403', () => {
  it('returns 403 when section belongs to a different school', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SECTION_A, school_id: SCHOOL_B }] });
    const result = await call('GET', `/plans/${SECTION_A}`);
    expect(result.status).toBe(403);
  });
});

describe('Principal flags — cross-school returns 403', () => {
  it('POST flag returns 403 for section in another school', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SECTION_A, school_id: SCHOOL_B }] });
    const result = await call('POST', `/flags/${SECTION_A}`, { flag_note: 'test' });
    expect(result.status).toBe(403);
  });
});

describe('Principal flags — flag/unflag round-trip', () => {
  it('POST flag sets flagged fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: SECTION_A, school_id: SCHOOL_A }] }) // section check
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    const result = await call('POST', `/flags/${SECTION_A}`, { flag_note: 'needs attention' });
    expect(result.status).toBe(200);
    expect(result.body.message).toMatch(/flagged/i);
  });

  it('DELETE unflag clears flagged fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: SECTION_A, school_id: SCHOOL_A }] }) // section check
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    const result = await call('DELETE', `/flags/${SECTION_A}`, {});
    expect(result.status).toBe(200);
    expect(result.body.message).toMatch(/unflagged/i);
  });
});
