/**
 * Simple regex-based parser for github.com/trending page HTML.
 * Designed to run without heavy DOM dependencies inside n8n Code nodes or Node.js.
 */
export function parseTrending(html, limit = 3) {
  const repos = [];
  const articleRegex = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null && repos.length < limit) {
    const block = match[1];

    // Repo owner and name from the first anchor with /owner/repo href.
    const repoMatch = /href="\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)"/.exec(block);
    if (!repoMatch) continue;
    const owner = repoMatch[1];
    const repo = repoMatch[2];

    // Description / What it is.
    const descMatch = /<p class="[^"]*col-9[^"]*">([\s\S]*?)<\/p>/.exec(block);
    const rawDesc = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : 'No description provided.';
    const whatItIs = decodeHtml(rawDesc);

    // Language.
    const langMatch = /itemprop="programmingLanguage">([^<]+)<\/span>/.exec(block);
    const language = langMatch ? langMatch[1].trim() : 'Unknown';

    // Stars today.
    const starsTodayMatch = /([0-9,]+)\s+stars today/.exec(block);
    const starsToday = starsTodayMatch ? starsTodayMatch[1].replace(/,/g, '') : 'N/A';

    // Total stars from stargazers link.
    const totalStarsMatch = /\/stargazers">[\s]*([0-9,]+)[\s]*<\/a>/.exec(block);
    const totalStars = totalStarsMatch ? totalStarsMatch[1].replace(/,/g, '') : 'N/A';

    // What it does summary bullets.
    const truncatedFocus = whatItIs.length > 100 ? `${whatItIs.slice(0, 100)}...` : whatItIs;
    const whatItDoes = [
      `Primary focus: ${truncatedFocus}`,
      `Built with ${language}, gaining ${starsToday} stars today`
    ];

    repos.push({
      owner,
      repo,
      language,
      starsToday,
      totalStars,
      whatItIs,
      whatItDoes
    });
  }

  return repos;
}

export function formatTelegramCard(repoInfo, index) {
  const bullets = repoInfo.whatItDoes.map(bullet => `• ${bullet}`).join('\n');
  return `🔥 Trending #${index}: ${repoInfo.owner}/${repoInfo.repo}
⭐ ${repoInfo.starsToday} stars today | 🌐 ${repoInfo.language}

📌 What it is:
${repoInfo.whatItIs}

⚡ What it does:
${bullets}

🔗 https://github.com/${repoInfo.owner}/${repoInfo.repo}`;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
