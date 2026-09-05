import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HARD_MAX_PUBLIC_PROMPT_CHARS,
  resolveConfiguredPromptLimit,
  resolvePublicConcurrencyLimit,
  resolvePublicRateLimits,
} from '../lib/security/abuse-limits.ts';
import { RequestBodyTooLargeError, readJsonBodyWithLimit } from '../lib/security/request-body.ts';

test('configured prompt limit is bounded by a safe hard ceiling', () => {
  assert.equal(resolveConfiguredPromptLimit(4000), 4000);
  assert.equal(resolveConfiguredPromptLimit(50), 100);
  assert.equal(resolveConfiguredPromptLimit(999999), HARD_MAX_PUBLIC_PROMPT_CHARS);
});

test('image generation receives stricter public quota caps than normal chat', () => {
  assert.deepEqual(resolvePublicRateLimits({
    scope: 'chat',
    configuredRpm: 30,
    configuredDaily: 200,
    authenticated: false,
  }), { rpm: 30, daily: 200 });

  assert.deepEqual(resolvePublicRateLimits({
    scope: 'image',
    configuredRpm: 30,
    configuredDaily: 200,
    authenticated: false,
  }), { rpm: 6, daily: 40 });

  assert.deepEqual(resolvePublicRateLimits({
    scope: 'image',
    configuredRpm: 30,
    configuredDaily: 200,
    authenticated: true,
  }), { rpm: 12, daily: 80 });
});

test('chat concurrency is bounded for guests and signed-in users', () => {
  assert.equal(resolvePublicConcurrencyLimit('chat', false), 2);
  assert.equal(resolvePublicConcurrencyLimit('chat', true), 3);
  assert.equal(resolvePublicConcurrencyLimit('image', false), 1);
});

test('bounded JSON reader accepts an ordinary request body', async () => {
  const request = new Request('https://example.test/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'hello' }),
  });
  const body = await readJsonBodyWithLimit<{ message: string }>(request, 1024);
  assert.equal(body.message, 'hello');
});

test('bounded JSON reader rejects oversized bodies even without relying on Content-Length', async () => {
  const request = new Request('https://example.test/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'x'.repeat(2048) }),
  });
  await assert.rejects(
    () => readJsonBodyWithLimit(request, 128),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
  );
});
