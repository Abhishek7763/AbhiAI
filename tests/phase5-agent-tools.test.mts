import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('phase 5 exposes all three callable agent tools', () => {
  const tools = source('lib/ai/tools.ts');
  assert.match(tools, /name: 'web_search'/);
  assert.match(tools, /name: 'document_qa'/);
  assert.match(tools, /name: 'image_generation'/);
  assert.match(tools, /generateImageWithConfiguredProviders/);
});

test('specialized agents can use live search without the manual web toggle', () => {
  for (const path of ['app/api/chat/route.ts', 'app/api/chat/stream/route.ts']) {
    const route = source(path);
    assert.doesNotMatch(route, /tool\.name === 'web_search' && !webSearchEnabled/);
    assert.match(route, /allowedToolNames\.has\(tool\.name\)/);
  }
});

test('agent runtime controls are enforced by the gateway and providers', () => {
  const streamRoute = source('app/api/chat/stream/route.ts');
  const route = source('app/api/chat/route.ts');
  const google = source('lib/ai/providers/google.ts');
  const openai = source('lib/ai/providers/openai-compatible.ts');

  assert.match(streamRoute, /memoryEnabled === false \? \[\] : safeHistory/);
  assert.match(route, /memoryEnabled === false \? \[\] : safeHistory/);
  assert.match(google, /maxOutputTokens/);
  assert.match(google, /temperature: runtime\.temperature/);
  assert.match(openai, /max_tokens: tokenLimit/);
  assert.match(openai, /const temperature = runtime\?\.temperature \?\? 0\.7/);
});

test('agent builder exposes tools, memory, temperature, max tokens and visibility', () => {
  const builder = source('app/admin/(dashboard)/agents/page.tsx');
  assert.match(builder, /id: 'image_generation'/);
  assert.match(builder, /Memory \{/);
  assert.match(builder, /Max Tokens/);
  assert.match(builder, /Temperature/);
  assert.match(builder, /Visibility/);
});

test('image API and agent tools share the same generation service', () => {
  const imageRoute = source('app/api/generate-image/route.ts');
  const tools = source('lib/ai/tools.ts');
  assert.match(imageRoute, /generateImageWithConfiguredProviders/);
  assert.match(tools, /generateImageWithConfiguredProviders/);
});
