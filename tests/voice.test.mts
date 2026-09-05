import assert from 'node:assert/strict';
import test from 'node:test';

import { detectSpeechLanguage, toSpeakableText } from '../lib/voice.ts';

test('toSpeakableText removes markdown noise while preserving readable text', () => {
  const input = '# Hello **world**\n\nRead [the guide](https://example.com). `const x = 1`\n```ts\nsecret();\n```';
  const result = toSpeakableText(input);

  assert.equal(result, 'Hello world Read the guide. const x = 1 Code snippet omitted.');
});

test('detectSpeechLanguage recognizes Devanagari as Hindi', () => {
  assert.equal(detectSpeechLanguage('नमस्ते, आज हम गणित पढ़ेंगे।', 'en-US'), 'hi-IN');
});

test('detectSpeechLanguage keeps the browser fallback for Latin text', () => {
  assert.equal(detectSpeechLanguage('Explain this in simple terms.', 'en-IN'), 'en-IN');
});
