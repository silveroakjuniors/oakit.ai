// @ts-ignore: optional runtime dependency without types in some dev environments
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;
let redisClient: RedisClient | null = null;

const noop = async (..._args: any[]) => null;

// Safe proxy — all methods are no-ops if Redis is unavailable
export const redis = new Proxy({} as RedisClient, {
  get(_target, prop) {
    if (redisClient) {
      return (redisClient as any)[prop];
    }
    return noop;
  },
});

export async function connectRedis() {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { reconnectStrategy: false },
    });
    client.on('error', () => {});
    await client.connect();
    redisClient = client;
    console.log('Redis connected');
  } catch {
    console.warn('Redis unavailable, continuing without cache');
  }
}

export function isRedisConnected() {
  return !!redisClient;
}
