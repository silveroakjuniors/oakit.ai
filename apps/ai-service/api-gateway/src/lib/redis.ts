/**
 * Redis client — supports both:
 *   - Upstash Redis (REST API, used in production via UPSTASH_REDIS_REST_URL + TOKEN)
 *   - Standard Redis (TCP, used in local dev via REDIS_URL)
 *
 * Upstash takes priority if UPSTASH_REDIS_REST_URL is set.
 * Falls back to no-op proxy if neither is available.
 */

const noop = async (..._args: any[]): Promise<any> => null;

// ─── Upstash REST client (production) ────────────────────────────────────────
class UpstashRedis {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  private async cmd(...args: any[]): Promise<any> {
    try {
      const res = await fetch(`${this.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      return data.result ?? null;
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.cmd('GET', key);
  }

  async set(key: string, value: string): Promise<string | null> {
    return this.cmd('SET', key, value);
  }

  async setEx(key: string, seconds: number, value: string): Promise<string | null> {
    return this.cmd('SET', key, value, 'EX', seconds);
  }

  async del(key: string): Promise<number> {
    return this.cmd('DEL', key);
  }

  async exists(key: string): Promise<number> {
    return this.cmd('EXISTS', key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.cmd('EXPIRE', key, seconds);
  }

  async incr(key: string): Promise<number> {
    return this.cmd('INCR', key);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.cmd('HSET', key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.cmd('HGET', key, field);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.cmd('HGETALL', key);
  }

  async pExpire(key: string, milliseconds: number): Promise<number> {
    return this.cmd('PEXPIRE', key, milliseconds);
  }

  async pTTL(key: string): Promise<number> {
    return this.cmd('PTTL', key);
  }

  async ttl(key: string): Promise<number> {
    return this.cmd('TTL', key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.cmd('KEYS', pattern);
  }

  async flushdb(): Promise<string> {
    return this.cmd('FLUSHDB');
  }
}

// ─── Standard Redis client (local dev) ───────────────────────────────────────
type RedisClient = any;
let standardClient: RedisClient | null = null;

// ─── Unified redis export ─────────────────────────────────────────────────────
let _upstash: UpstashRedis | null = null;

// Build the upstash client immediately if env vars are present
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  _upstash = new UpstashRedis(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
  console.log('[Redis] Using Upstash REST client');
}

export const redis = new Proxy({} as any, {
  get(_target, prop: string) {
    // Upstash takes priority
    if (_upstash && typeof (_upstash as any)[prop] === 'function') {
      return (_upstash as any)[prop].bind(_upstash);
    }
    // Standard Redis fallback
    if (standardClient && typeof standardClient[prop] === 'function') {
      return standardClient[prop].bind(standardClient);
    }
    // No-op if neither available
    return noop;
  },
});

export async function connectRedis() {
  // If Upstash is configured, no TCP connection needed
  if (_upstash) {
    console.log('[Redis] Upstash ready (REST mode, no TCP connection needed)');
    return;
  }

  // Try standard Redis for local dev
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl.includes('localhost')) {
    console.warn('[Redis] No Redis configured — running without cache (AI question limits disabled)');
    return;
  }

  try {
    const { createClient } = await import('redis');
    const client = createClient({
      url: redisUrl,
      socket: { reconnectStrategy: false, tls: redisUrl.startsWith('rediss://') },
    });
    client.on('error', () => {});
    await client.connect();
    standardClient = client;
    console.log('[Redis] Standard Redis connected');
  } catch {
    console.warn('[Redis] Connection failed — running without cache');
  }
}

export function isRedisConnected() {
  return !!_upstash || !!standardClient;
}
