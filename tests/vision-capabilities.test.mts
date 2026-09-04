import assert from 'node:assert/strict';
import test from 'node:test';
import { connectionSupportsVision } from '../lib/ai/vision-capabilities.ts';

const baseConnection = {
  name: 'Text Model',
  modelId: 'text-model',
  providerId: 'openai-compatible',
  baseUrl: 'https://example.invalid/v1',
};

test('Google/Gemini connections remain multimodal-compatible', () => {
  assert.equal(connectionSupportsVision({ ...baseConnection, providerId: 'google', modelId: 'gemini-flash' }), true);
});

test('runtime vision capability enables an otherwise generic model', () => {
  assert.equal(connectionSupportsVision(baseConnection, { capabilities: ['text', 'vision'] }), true);
});

test('known vision model naming is detected for older saved connections', () => {
  assert.equal(connectionSupportsVision({ ...baseConnection, modelId: 'qwen2.5-vl-72b-instruct' }), true);
  assert.equal(connectionSupportsVision({ ...baseConnection, modelId: 'gpt-4o-mini' }), true);
});

test('plain text-only model is not routed an image', () => {
  assert.equal(connectionSupportsVision(baseConnection, { capabilities: ['text', 'fast'] }), false);
});
