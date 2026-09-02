import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptApiKey, encryptApiKey, maskApiKey } from '../lib/security/api-key-crypto.ts';

test('encrypts an API key with authenticated encryption and decrypts it', () => {
  const previous = process.env.AI_KEYS_ENCRYPTION_KEY;
  process.env.AI_KEYS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

  try {
    const first = encryptApiKey('sk-example-secret-12345678');
    const second = encryptApiKey('sk-example-secret-12345678');

    assert.equal(decryptApiKey(first), 'sk-example-secret-12345678');
    assert.notEqual(first.encryptedKey, second.encryptedKey);
    assert.equal(first.fingerprint, second.fingerprint);
    assert.equal(first.maskedKey, 'sk-e••••5678');
  } finally {
    if (previous === undefined) delete process.env.AI_KEYS_ENCRYPTION_KEY;
    else process.env.AI_KEYS_ENCRYPTION_KEY = previous;
  }
});

test('rejects an invalid encryption key length', () => {
  const previous = process.env.AI_KEYS_ENCRYPTION_KEY;
  process.env.AI_KEYS_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
  try {
    assert.throws(() => encryptApiKey('valid-looking-api-key'), /exactly 32 bytes/);
  } finally {
    if (previous === undefined) delete process.env.AI_KEYS_ENCRYPTION_KEY;
    else process.env.AI_KEYS_ENCRYPTION_KEY = previous;
  }
});

test('fully masks short secrets', () => {
  assert.equal(maskApiKey('short'), '••••••••');
});
