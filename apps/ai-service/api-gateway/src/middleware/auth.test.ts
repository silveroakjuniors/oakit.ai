import { jwtVerify, schoolScope } from './auth';
import { signToken } from '../lib/jwt';
import type { Request, Response, NextFunction } from 'express';

// Mock redis
jest.mock('../lib/redis', () => ({
  redis: { sIsMember: jest.fn().mockResolvedValue(false) },
}));

import { redis } from '../lib/redis';
const mockSIsMember = redis.sIsMember as jest.Mock;

function makeReq(token?: string, overrides: Partial<Request> = {}): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

const next: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockSIsMember.mockResolvedValue(false);
});

describe('jwtVerify', () => {
  it('passes valid token without jti', async () => {
    const token = signToken({ user_id: 'u1', school_id: 's1', role: 'admin', permissions: [] });
    const req = makeReq(token);
    const { res } = makeRes();
    await jwtVerify(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockSIsMember).not.toHaveBeenCalled();
  });

  it('returns 401 for revoked jti', async () => {
    mockSIsMember.mockResolvedValue(true);
    const token = signToken({ user_id: 'u1', school_id: 's1', role: 'admin', permissions: [], jti: 'test-jti' });
    const req = makeReq(token);
    const { res, status, json } = makeRes();
    await jwtVerify(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes valid impersonation token with non-revoked jti', async () => {
    mockSIsMember.mockResolvedValue(false);
    const token = signToken({ user_id: 'u1', school_id: 's1', role: 'admin', permissions: [], jti: 'valid-jti' });
    const req = makeReq(token);
    const { res } = makeRes();
    await jwtVerify(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('schoolScope', () => {
  it('super_admin bypasses school_id check', () => {
    const req = {
      user: { user_id: 'u1', school_id: null, role: 'super_admin', permissions: [] },
      params: { school_id: 'other-school' },
      body: {},
    } as unknown as Request;
    const { res } = makeRes();
    schoolScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('non-super_admin with matching school_id passes', () => {
    const req = {
      user: { user_id: 'u1', school_id: 's1', role: 'admin', permissions: [] },
      params: { school_id: 's1' },
      body: {},
    } as unknown as Request;
    const { res } = makeRes();
    schoolScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('non-super_admin with mismatched school_id returns 403', () => {
    const req = {
      user: { user_id: 'u1', school_id: 's1', role: 'admin', permissions: [] },
      params: { school_id: 's2' },
      body: {},
    } as unknown as Request;
    const { res, status, json } = makeRes();
    schoolScope(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Access denied: cross-school request' });
    expect(next).not.toHaveBeenCalled();
  });
});
