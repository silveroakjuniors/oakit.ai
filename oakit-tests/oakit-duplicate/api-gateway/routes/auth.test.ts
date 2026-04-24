import bcrypt from 'bcryptjs';

jest.mock('../lib/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../lib/redis', () => ({ redis: { sIsMember: jest.fn().mockResolvedValue(false) } }));

import { pool } from '../lib/db';
import { verifyToken } from '../lib/jwt';
import authRouter from './auth';
import express from 'express';
import http from 'http';

const mockQuery = pool.query as jest.Mock;
const HASH = bcrypt.hashSync('password123', 10);

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

function callLogin(body: Record<string, string>): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as any).port;
      const data = JSON.stringify(body);
      const options = {
        hostname: '127.0.0.1',
        port,
        path: '/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      };
      const r = http.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode!, body: JSON.parse(raw) });
        });
      });
      r.write(data);
      r.end();
    });
  });
}

beforeEach(() => mockQuery.mockReset());

describe('POST /auth/login — inactive school', () => {
  it('returns 401 when school status is inactive', async () => {
    // When school_code is provided, super_admin block is skipped — first query is school lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', status: 'inactive' }] });
    const result = await callLogin({ school_code: 'testschool', email: 'user@test.com', password: 'password123' });
    expect(result.status).toBe(401);
    expect(result.body.error).toMatch(/inactive/i);
  });
});

describe('POST /auth/login — super_admin', () => {
  it('succeeds without school_code and token has school_id=null', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'sa-1', password_hash: HASH, is_active: true, role: 'super_admin' }],
    });
    const result = await callLogin({ email: 'admin@platform.com', password: 'password123' });
    expect(result.status).toBe(200);
    expect(result.body.role).toBe('super_admin');
    const payload = verifyToken(result.body.token);
    expect(payload.school_id).toBeNull();
  });

  it('returns 401 for wrong password', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'sa-1', password_hash: HASH, is_active: true, role: 'super_admin' }],
    });
    const result = await callLogin({ email: 'admin@platform.com', password: 'wrongpass' });
    expect(result.status).toBe(401);
  });
});
