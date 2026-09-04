import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public selector exposes branded AbhiAI aliases, not backend defaults', async () => {
  const selector = await source('components/chat/model-selector.tsx');
  for (const alias of ['abhiai-fast', 'abhiai-think', 'abhiai-vision', 'abhiai-code', 'abhiai-creative']) {
    assert.match(selector, new RegExp(alias));
  }
  assert.doesNotMatch(selector, /gemini-3\.[0-9]/);
});

test('public models endpoint is alias-backed', async () => {
  const route = await source('app/api/models/public/route.ts');
  assert.match(route, /listPublicAliases/);
  assert.doesNotMatch(route, /getStoredModels/);
  assert.doesNotMatch(route, /model\.id/);
});

test('central router resolves Phase 9 aliases server-side', async () => {
  const router = await source('lib/ai/router.ts');
  assert.match(router, /resolvePublicAlias/);
  assert.match(router, /startsWith\('abhiai-'\)/);
  assert.match(router, /return \{ primary: null, fallbacks: \[\] \}/);
});

test('admin alias mapping page and protected API exist', async () => {
  const page = await source('app/admin/(dashboard)/public-ai/page.tsx');
  const api = await source('app/api/admin/public-aliases/route.ts');
  const middleware = await source('lib/supabase/middleware.ts');
  assert.match(page, /Public AI Aliases/);
  assert.match(page, /Save aliases/);
  assert.match(api, /savePublicAliasMappings/);
  assert.match(middleware, /pathname\.startsWith\('\/api\/admin\/'\)/);
});
