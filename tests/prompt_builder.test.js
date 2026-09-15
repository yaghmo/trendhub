import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiPayload, extractGeminiText } from '../src/prompt_builder.js';

const repoData = {
  owner: 'cool-org',
  repo: 'awesome-tool',
  description: 'Fast high-performance terminal emulator written in Rust.',
  language: 'Rust',
  readmeText: '# awesome-tool\nA terminal emulator.'
};

test('buildGeminiPayload caps README at 8000 characters', () => {
  const payload = buildGeminiPayload({ ...repoData, readmeText: 'A'.repeat(10000) });
  const text = payload.contents[0].parts[0].text;

  assert.ok(!text.includes('A'.repeat(8001)));
  assert.ok(text.includes('A'.repeat(8000)));
});

test('buildGeminiPayload includes repo identity, language, and repo URL', () => {
  const payload = buildGeminiPayload(repoData);
  const text = payload.contents[0].parts[0].text;

  assert.ok(text.includes('cool-org/awesome-tool'));
  assert.ok(text.includes('Rust'));
  assert.ok(text.includes('https://github.com/cool-org/awesome-tool'));
  assert.equal(payload.generationConfig.maxOutputTokens, 1000);
});

test('buildGeminiPayload tolerates missing README and language', () => {
  const payload = buildGeminiPayload({ owner: 'o', repo: 'r' });
  const text = payload.contents[0].parts[0].text;

  assert.ok(text.includes('o/r'));
  assert.ok(text.includes('Unknown'));
});

test('extractGeminiText returns the candidate text and throws on malformed response', () => {
  assert.equal(
    extractGeminiText({ candidates: [{ content: { parts: [{ text: 'draft body' }] } }] }),
    'draft body'
  );
  assert.throws(() => extractGeminiText({}), /Failed to parse Gemini response/);
});