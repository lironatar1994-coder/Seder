import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

function key() {
  const value = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '', 'base64');
  if (value.length !== 32) throw new Error('GOOGLE_CONFIG_MISSING');
  return value;
}
export function sealToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function openToken(value: string) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('GOOGLE_TOKEN_INVALID');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
export function hashState(value: string) { return createHash('sha256').update(value).digest('hex'); }
