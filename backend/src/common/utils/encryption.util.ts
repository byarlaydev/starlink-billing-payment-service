import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
  return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateChecksum(buffer: Buffer): string {
  return createHmac('sha256', getEncryptionKey())
    .update(buffer)
    .digest('hex');
}

export function maskSensitive(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) return '****';
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}
