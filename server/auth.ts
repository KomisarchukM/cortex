import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
export const token = () => randomBytes(32).toString('base64url');
export const validToken = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
export const digest = (v: string, secret: string) =>
  createHmac('sha256', secret).update(v).digest('hex');
const scryptAsync = promisify(scrypt);
export async function passwordHash(password: string) {
  if (password.length < 12) throw new Error('Choose at least 12 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${((await scryptAsync(password, salt, 64)) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, key] = encoded.split(':');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(key || '')) return false;
  const got = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(got, Buffer.from(key, 'hex'));
}
