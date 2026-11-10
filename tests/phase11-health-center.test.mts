import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Phase 11 health API exposes required health states and diagnostics', async () => {
  const route = await source('app/api/admin/health/route.ts');
  for (const state of ['HEALTHY', 'RATE_LIMITED', 'AUTH_ERROR', 'CONFIG_ERROR', 'OFFLINE']) {
    assert.match(route, new RegExp(state));
  }
  assert.match(route, /failureReason/);
  assert.match(route, /lastChecked/);
  assert.match(route, /listRuntimeRoutingSignals/);
});

test('Phase 11 Health Center shows last check and failure context', async () => {
  const page = await source('app/admin/(dashboard)/health/page.tsx');
  assert.match(page, /Health Center/);
  assert.match(page, /Last checked/);
  assert.match(page, /Failure reason/);
  assert.match(page, /Last runtime failure/);
  assert.match(page, /Consecutive failures/);
  assert.match(page, /Run Health Diagnostics/);
});

test('runtime health persists a human-readable failure reason', async () => {
  const runtime = await source('lib/ai/runtime-health.ts');
  assert.match(runtime, /lastFailureReason/);
  assert.match(runtime, /diagnosis\.userTitle/);
  assert.match(runtime, /lastFailureReason: null/);
});
