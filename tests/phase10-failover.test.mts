import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailoverError, clampFailoverAttempts, clampProviderTimeoutMs } from '../lib/ai/failover.ts';

test('Phase 10 retries transient provider failures', () => {
  assert.equal(classifyFailoverError(new Error('429 Too Many Requests')).retryable, true);
  assert.equal(classifyFailoverError(new Error('504 upstream timeout')).retryable, true);
  assert.equal(classifyFailoverError(new Error('invalid api key 401')).retryable, true);
});

test('Phase 10 does not retry request or policy failures', () => {
  assert.equal(classifyFailoverError(new Error('400 invalid request')).retryable, false);
  assert.equal(classifyFailoverError(new Error('blocked prompt by safety policy')).retryable, false);
  assert.equal(classifyFailoverError(new Error('CLIENT_ABORTED')).retryable, false);
});

test('Phase 10 bounds attempts and timeout', () => {
  assert.equal(clampFailoverAttempts(99), 4);
  assert.equal(clampFailoverAttempts(0), 1);
  assert.equal(clampFailoverAttempts(3, 2), 2);
  assert.equal(clampProviderTimeoutMs(1000), 8000);
  assert.equal(clampProviderTimeoutMs(200000), 90000);
});
