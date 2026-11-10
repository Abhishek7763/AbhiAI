import assert from 'node:assert/strict';
import test from 'node:test';
import { moderateImagePrompt } from '../lib/security/image-moderation.ts';
import { extractClientIp, isTrustedRequestSource, parseAllowedOrigins } from '../lib/security/request-origin.ts';

test('accepts same-origin browser requests and configured aliases', () => {
  assert.equal(isTrustedRequestSource({
    requestUrl: 'https://abhiai.vercel.app/api/chat/stream',
    origin: 'https://abhiai.vercel.app',
    referer: 'https://abhiai.vercel.app/',
    secFetchSite: 'same-origin',
  }), true);

  assert.equal(isTrustedRequestSource({
    requestUrl: 'https://preview.example.vercel.app/api/chat',
    origin: 'https://abhiai.vercel.app',
    allowedOrigins: ['https://abhiai.vercel.app'],
  }), true);
});

test('rejects browser cross-site and null-origin requests', () => {
  assert.equal(isTrustedRequestSource({
    requestUrl: 'https://abhiai.vercel.app/api/chat',
    origin: 'https://evil.example',
    secFetchSite: 'cross-site',
  }), false);

  assert.equal(isTrustedRequestSource({
    requestUrl: 'https://abhiai.vercel.app/api/chat',
    origin: 'null',
  }), false);
});

test('allows originless server callers to continue to rate limiting and bot checks', () => {
  assert.equal(isTrustedRequestSource({
    requestUrl: 'https://abhiai.vercel.app/api/chat',
  }), true);
});

test('parses configured origins safely', () => {
  assert.deepEqual(
    parseAllowedOrigins('https://abhiai.vercel.app, https://preview.example/invalid/../'),
    ['https://abhiai.vercel.app', 'https://preview.example'],
  );
});

test('extracts the first trusted forwarding candidate', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.20, 10.0.0.1',
  });
  assert.equal(extractClientIp(headers), '203.0.113.20');
});

test('image moderation allows ordinary creative prompts', () => {
  assert.deepEqual(moderateImagePrompt('A teenager studying physics in a bright library'), { allowed: true });
  assert.deepEqual(moderateImagePrompt('Breast cancer awareness ribbon, clean medical infographic'), { allowed: true });
});

test('image moderation blocks explicit sexual content and sexual content involving minors', () => {
  assert.equal(moderateImagePrompt('Create an explicit nude pornographic scene').allowed, false);
  assert.deepEqual(
    moderateImagePrompt('Pornographic image involving an underage child'),
    { allowed: false, category: 'sexual-minors' },
  );
});

test('image moderation blocks graphic gore and explicit self-harm scenes', () => {
  assert.deepEqual(
    moderateImagePrompt('A graphic gore scene with a severed head'),
    { allowed: false, category: 'graphic-violence' },
  );
  assert.deepEqual(
    moderateImagePrompt('A realistic scene of someone cutting wrists'),
    { allowed: false, category: 'self-harm' },
  );
});
