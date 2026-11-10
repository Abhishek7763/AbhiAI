import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonFile, writeJsonFile } from '../lib/config/file-store.ts';

test('returns null when a JSON file does not exist', () => {
  assert.equal(readJsonFile('missing-phase-one-fixture.json'), null);
});

test('refuses filesystem writes in the Vercel runtime', () => {
  const previousValue = process.env.VERCEL;
  process.env.VERCEL = '1';

  try {
    assert.equal(writeJsonFile('blocked-phase-one-fixture.json', { safe: true }), false);
  } finally {
    if (previousValue === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previousValue;
    }
  }
});
