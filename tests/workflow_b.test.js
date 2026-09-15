import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = JSON.parse(fs.readFileSync('workflows/draft-generator.json', 'utf8'));
const nodeNames = workflow.nodes.map(n => n.name);
const node = name => workflow.nodes.find(n => n.name === name);

test('Workflow B has the required nodes', () => {
  assert.ok(Array.isArray(workflow.nodes));
  for (const name of [
    'Telegram Trigger',
    'Extract Repo Target',
    'Route Action',
    'Fetch Repo & Readme',
    'Call Gemini API',
    'Send Draft to Telegram'
  ]) {
    assert.ok(nodeNames.includes(name), `missing node: ${name}`);
  }
});

test('Workflow B trigger listens to callback queries and messages', () => {
  const trigger = node('Telegram Trigger');
  assert.equal(trigger.type, 'n8n-nodes-base.telegramTrigger');
  assert.deepEqual(trigger.parameters.updates, ['callback_query', 'message']);
});

test('Workflow B routes skip and draft actions', () => {
  const route = node('Route Action');
  assert.equal(route.type, 'n8n-nodes-base.switch');
  assert.ok(JSON.stringify(route.parameters).includes('skip'));
});

test('Workflow B extracts owner and repo from both callbacks and URLs', () => {
  const code = node('Extract Repo Target').parameters.jsCode;
  assert.match(code, /callback_query/);
  assert.match(code, /github\\\.com/);
});

test('Workflow B fetches README then calls Gemini with the API key', () => {
  assert.match(node('Fetch Repo & Readme').parameters.url, /api\.github\.com\/repos/);

  const gemini = node('Call Gemini API');
  assert.match(gemini.parameters.url, /generativelanguage\.googleapis\.com/);
  assert.match(gemini.parameters.url, /gemini-3\.5-flash-lite:generateContent/);
  assert.match(gemini.parameters.url, /GEMINI_API_KEY/);
});

test('Workflow B wires trigger to extract to route to draft sender', () => {
  assert.equal(workflow.connections['Telegram Trigger'].main[0][0].node, 'Extract Repo Target');
  assert.equal(workflow.connections['Extract Repo Target'].main[0][0].node, 'Route Action');
  assert.equal(workflow.connections['Route Action'].main[0][0].node, 'Send Ack');
  assert.equal(workflow.connections['Route Action'].main[1][0].node, 'Send Status Ack');
  assert.equal(workflow.connections['Send Status Ack'].main[0][0].node, 'Fetch Repo & Readme');
  assert.equal(workflow.connections['Fetch Repo & Readme'].main[0][0].node, 'Call Gemini API');
  assert.equal(workflow.connections['Call Gemini API'].main[0][0].node, 'Send Draft to Telegram');
});