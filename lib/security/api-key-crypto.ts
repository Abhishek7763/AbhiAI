import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface EncryptedApiKey {
  encryptedKey: string;
  iv: string;
  tag: string;
  fingerprint: string;
  maskedKey: string;
  version: 1;
}

function getEncryptionKey(): Buffer {
  const encoded = process.env.AI_KEYS_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error('AI_KEYS_ENCRYPTION_KEY is not configured. Add a base64-encoded 32-byte key.');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('AI_KEYS_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

export function encryptApiKey(apiKey: string): EncryptedApiKey {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error('API key cannot be empty.');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    fingerprint: createHash('sha256').update(normalized).digest('hex'),
    maskedKey: maskApiKey(normalized),
    version: 1,
  };
}

export function decryptApiKey(payload: Pick<EncryptedApiKey, 'encryptedKey' | 'iv' | 'tag' | 'version'>): string {
  if (payload.version !== 1) throw new Error(`Unsupported API key encryption version: ${payload.version}`);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedKey, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
