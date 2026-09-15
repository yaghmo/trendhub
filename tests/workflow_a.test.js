import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = JSON.parse(fs.readFileSync('workflows/daily-digest.json', 'utf8'));
const nodeNames = workflow.nodes.map(n => n.name);

test('Workflow A has the required nodes', () => {
  assert.ok(Array.isArray(workflow.nodes));
  for (const name of [
    'Schedule Trigger',
    'Fetch Trending HTML',
    'Parse Top 3 Repos',
    'Split In Batches',
    'Send Telegram Cards'
  ]) {
    assert.ok(nodeNames.includes(name), `missing node: ${name}`);
  }
});

test('Workflow A schedule trigger runs every 2 days at 08:00', () => {
  const trigger = workflow.nodes.find(n => n.name === 'Schedule Trigger');
  assert.equal(trigger.type, 'n8n-nodes-base.scheduleTrigger');
  assert.equal(trigger.parameters.rule.interval[0].field, 'cron');
  assert.equal(trigger.parameters.rule.interval[0].expression, '0 8 */2 * *');
});

test('Workflow A fetches the daily trending page', () => {
  const fetch = workflow.nodes.find(n => n.name === 'Fetch Trending HTML');
  assert.match(fetch.parameters.url, /github\.com\/trending/);
});

test('Workflow A wires trigger to fetch to parse to loop to telegram', () => {
  assert.deepEqual(workflow.connections['Schedule Trigger'].main[0][0].node, 'Fetch Trending HTML');
  assert.deepEqual(workflow.connections['Fetch Trending HTML'].main[0][0].node, 'Parse Top 3 Repos');
  assert.deepEqual(workflow.connections['Parse Top 3 Repos'].main[0][0].node, 'Split In Batches');
  assert.deepEqual(workflow.connections['Split In Batches'].main[0][0].node, 'Send Telegram Cards');
});

test('Workflow A parse code node embeds the trending parser', () => {
  const parse = workflow.nodes.find(n => n.name === 'Parse Top 3 Repos');
  assert.match(parse.parameters.jsCode, /parseTrending/);
  assert.match(parse.parameters.jsCode, /Box-row/);
});