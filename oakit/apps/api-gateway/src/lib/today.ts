import { redis } from './redis';
import fs from 'fs';
import path from 'path';

// Always resolve relative to this file's directory — consistent regardless of cwd
const TM_FILE = path.resolve(__dirname, '../../time_machine.json');
console.log(`[TimeMachine] Store file: ${TM_FILE}`);

function readFileStore(): Record<string, { date: string; expires: number }> {
  try {
    if (fs.existsSync(TM_FILE)) {
      return JSON.parse(fs.readFileSync(TM_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function writeFileStore(store: Record<string, { date: string; expires: number }>) {
  try { fs.writeFileSync(TM_FILE, JSON.stringify(store, null, 2)); } catch {}
}

export async function setTimeMachine(schoolId: string, date: string, ttlSeconds: number): Promise<void> {
  const expires = Date.now() + ttlSeconds * 1000;
  // Try Redis first
  try {
    const result = await redis.set(`time_machine:${schoolId}`, date, { EX: ttlSeconds });
    if (result) {
      await redis.set(`time_machine:${schoolId}:expires`, new Date(expires).toISOString(), { EX: ttlSeconds });
      console.log(`[TimeMachine] Redis SET school=${schoolId} date=${date}`);
      return;
    }
  } catch {}
  // Fallback to file
  const store = readFileStore();
  store[schoolId] = { date, expires };
  writeFileStore(store);
  console.log(`[TimeMachine] File SET school=${schoolId} date=${date} (Redis unavailable)`);
}

export async function clearTimeMachine(schoolId: string): Promise<void> {
  try { await redis.del(`time_machine:${schoolId}`); } catch {}
  const store = readFileStore();
  delete store[schoolId];
  writeFileStore(store);
}

export async function getTimeMachineStatus(schoolId: string): Promise<{ active: boolean; mock_date: string | null; expires_at: string | null; ttl_seconds: number }> {
  // Try Redis
  try {
    const mock = await redis.get(`time_machine:${schoolId}`);
    if (mock) {
      const expiresAt = await redis.get(`time_machine:${schoolId}:expires`);
      const ttl = await redis.ttl(`time_machine:${schoolId}`);
      return { active: true, mock_date: mock, expires_at: expiresAt, ttl_seconds: ttl > 0 ? ttl : 0 };
    }
  } catch {}
  // Fallback to file
  const store = readFileStore();
  const entry = store[schoolId];
  if (entry && entry.expires > Date.now()) {
    return {
      active: true,
      mock_date: entry.date,
      expires_at: new Date(entry.expires).toISOString(),
      ttl_seconds: Math.ceil((entry.expires - Date.now()) / 1000),
    };
  }
  // Clean up expired entry
  if (entry) { delete store[schoolId]; writeFileStore(store); }
  return { active: false, mock_date: null, expires_at: null, ttl_seconds: 0 };
}

/**
 * Returns today's date as YYYY-MM-DD.
 * If a time machine mock date is set for this school, returns that instead.
 */
export async function getToday(schoolId: string): Promise<string> {
  const status = await getTimeMachineStatus(schoolId);
  if (status.active && status.mock_date) {
    console.log(`[TimeMachine] school=${schoolId} using mock date: ${status.mock_date}`);
    return status.mock_date;
  }
  return new Date().toISOString().split('T')[0];
}
