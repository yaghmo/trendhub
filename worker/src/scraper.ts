/**
 * Shared with n8n Code node. Keep decode + extract logic identical.
 * No DOM dependency so Worker and n8n Code node share it.
 */

export type RepoSummary = {
  owner: string;
  repo: string;
  language: string;
  starsToday: string;
  totalStars: string;
  whatItIs: string;
  whatItDoes: string[];
};

export function parseTrending(html: string, limit = 3): RepoSummary[] {
  const repos: RepoSummary[] = [];
  const articleRegex = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null && repos.length < limit) {
    const block = match[1];

    const repoMatch = /href="\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)"/.exec(block);
    if (!repoMatch) continue;
    const owner = repoMatch[1];
    const repo = repoMatch[2];

    const descMatch = /<p class="[^"]*col-9[^"]*">([\s\S]*?)<\/p>/.exec(block);
    const rawDesc = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "No description provided.";
    const whatItIs = decodeHtml(rawDesc);

    const langMatch = /itemprop="programmingLanguage">([^<]+)<\/span>/.exec(block);
    const language = langMatch ? langMatch[1].trim() : "Unknown";

    const starsTodayMatch = /([0-9,]+)\s+stars today/.exec(block);
    const starsToday = starsTodayMatch ? starsTodayMatch[1].replace(/,/g, "") : "N/A";

    const totalStarsMatch = /\/stargazers">[\s]*([0-9,]+)[\s]*<\/a>/.exec(block);
    const totalStars = totalStarsMatch ? totalStarsMatch[1].replace(/,/g, "") : "N/A";

    const truncatedFocus = whatItIs.length > 100 ? `${whatItIs.slice(0, 100)}...` : whatItIs;
    const whatItDoes = [
      `Primary focus: ${truncatedFocus}`,
      `Built with ${language}, gaining ${starsToday} stars today`,
    ];

    repos.push({ owner, repo, language, starsToday, totalStars, whatItIs, whatItDoes });
  }

  return repos;
}

export function formatTelegramCard(repo: RepoSummary, index: number): string {
  const bullets = repo.whatItDoes.map((b) => `• ${b}`).join("\n");
  return `🔥 Trending #${index}: ${repo.owner}/${repo.repo}\n⭐ ${repo.starsToday} stars today | 🌐 ${repo.language}\n\n📌 What it is:\n${repo.whatItIs}\n\n⚡ What it does:\n${bullets}\n\n🔗 https://github.com/${repo.owner}/${repo.repo}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}