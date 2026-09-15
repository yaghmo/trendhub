import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTelegramCard, parseTrending } from '../src/scraper.js';

const mockTrendingHtml = `
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/cool-org/awesome-tool">cool-org / awesome-tool</a>
  </h2>
  <p class="col-9 color-fg-muted my-1 pr-4">Fast high-performance terminal emulator written in Rust.</p>
  <div class="f6 color-fg-muted mt-2">
    <span class="d-inline-block ml-0 mr-3">
      <span class="repo-language-color"></span>
      <span itemprop="programmingLanguage">Rust</span>
    </span>
    <a class="Link--muted d-inline-block mr-3" href="/cool-org/awesome-tool/stargazers">12,450</a>
    <span class="d-inline-block float-sm-right">620 stars today</span>
  </div>
</article>
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/another-org/second-tool">another-org / second-tool</a>
  </h2>
</article>
`;

test('parseTrending extracts top repos with structured overview', () => {
  const results = parseTrending(mockTrendingHtml, 1);

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    owner: 'cool-org',
    repo: 'awesome-tool',
    language: 'Rust',
    starsToday: '620',
    totalStars: '12450',
    whatItIs: 'Fast high-performance terminal emulator written in Rust.',
    whatItDoes: [
      'Primary focus: Fast high-performance terminal emulator written in Rust.',
      'Built with Rust, gaining 620 stars today'
    ]
  });
});

test('parseTrending applies the requested limit', () => {
  const results = parseTrending(mockTrendingHtml, 2);

  assert.equal(results.length, 2);
  assert.equal(results[1].owner, 'another-org');
  assert.equal(results[1].repo, 'second-tool');
  assert.equal(results[1].language, 'Unknown');
  assert.equal(results[1].starsToday, 'N/A');
  assert.equal(results[1].totalStars, 'N/A');
  assert.equal(results[1].whatItIs, 'No description provided.');
});

test('formatTelegramCard creates one copy-ready digest card', () => {
  const repo = parseTrending(mockTrendingHtml, 1)[0];

  assert.equal(
    formatTelegramCard(repo, 1),
    '🔥 Trending #1: cool-org/awesome-tool\n' +
      '⭐ 620 stars today | 🌐 Rust\n\n' +
      '📌 What it is:\n' +
      'Fast high-performance terminal emulator written in Rust.\n\n' +
      '⚡ What it does:\n' +
      '• Primary focus: Fast high-performance terminal emulator written in Rust.\n' +
      '• Built with Rust, gaining 620 stars today\n\n' +
      '🔗 https://github.com/cool-org/awesome-tool'
  );
});
