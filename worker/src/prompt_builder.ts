/**
 * Two prompts: overview (explanatory what repo does, good for) and LinkedIn draft.
 * Kept here for Worker import. README cap 8000 chars.
 */

const README_LIMIT = 8000;

export type RepoForPrompt = {
  owner: string;
  repo: string;
  description?: string;
  language?: string;
  readmeText?: string;
  stars?: number;
};

export type GeminiPayload = {
  contents: { parts: { text: string }[] }[];
  generationConfig: { temperature: number; maxOutputTokens: number };
};

export function buildOverviewPayload(repo: RepoForPrompt): GeminiPayload {
  const truncated = (repo.readmeText || "").slice(0, README_LIMIT);
  const stars = repo.stars != null ? String(repo.stars) : "N/A";
  const text = `Explain this GitHub repository in a concise, informative overview.

Repo: https://github.com/${repo.owner}/${repo.repo}
Stars: ${stars}
Language: ${repo.language || "Unknown"}
Description: ${repo.description || "N/A"}
README (excerpt):
${truncated}

Produce a Telegram-ready overview. Format exactly:
1. Line 1: **${repo.owner}/${repo.repo}** — one line: what it is.
2. **What it does:** 2-3 sentences, plain.
3. **What it's good for:** 2-3 short bullet lines (dash bullets).
4. One line with: ⭐ **${stars}** stars | 🌐 ${repo.language || "Unknown"}

Keep it tight, no hashtags, no CTA. Use **bold** for headings only.`;

  return {
    contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 700 },
  };
}

export function buildGeminiPayload(repo: RepoForPrompt): GeminiPayload {
  const truncated = (repo.readmeText || "").slice(0, README_LIMIT);
  const text = `You write crisp, high-engagement LinkedIn posts in a curator/newsletter style.
Analyze this GitHub repository metadata and README, then produce a ready-to-post draft.

Repo: https://github.com/${repo.owner}/${repo.repo}
Language: ${repo.language || "Unknown"}
Description: ${repo.description || "N/A"}
README (excerpt):
${truncated}

Format requirements:
1. Hook line: 1 punchy sentence highlighting what problem it solves.
2. Summary (2-3 sentences): What it is and why it was built.
3. Key features & what it does (3-4 concise bullet points).
4. Why developers care (1 punchy takeaway).
5. Call to action + repo link: https://github.com/${repo.owner}/${repo.repo}
6. 3-5 relevant hashtags.

Tone: informative, direct, developer-focused, no corporate buzzwords or excessive hype.`;

  return {
    contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
  };
}

export function extractGeminiText(apiResponse: unknown): string {
  try {
    const v = apiResponse as { candidates: { content: { parts: { text: string }[] } }[] };
    return v.candidates[0].content.parts[0].text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Gemini response: ${msg}`);
  }
}
