/**
 * lib/credentialEncryption.ts
 * AES-256-CBC encryption for social media platform credentials.
 * Key must be 32 bytes (64 hex chars) stored in CREDENTIAL_ENCRYPTION_KEY env var.
 */
import * as crypto from 'crypto';

function getKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (!key || key.length !== 64) {
    throw new Error(`CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — got ${key.length} chars`);
  }
  return Buffer.from(key, 'hex');
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encrypted: string): string {
  if (!encrypted) return '';
  const [ivHex, data] = encrypted.split(':');
  if (!ivHex || !data) return '';
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivHex, 'hex'));
  return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
}

/** Mask a credential for safe display (shows last 4 chars only) */
export function maskCredential(value: string): string {
  if (!value || value.length < 8) return '****';
  return `****${value.slice(-4)}`;
}
