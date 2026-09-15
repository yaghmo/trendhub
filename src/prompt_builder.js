/**
 * Builds the Gemini request payload for LinkedIn draft generation.
 * Kept dependency-free so n8n Code nodes and local Node.js tests share the same logic.
 */
const README_LIMIT = 8000;

export function buildGeminiPayload({ owner, repo, description, language, readmeText }) {
  const truncatedReadme = (readmeText || '').slice(0, README_LIMIT);

  const promptText = `You write crisp, high-engagement LinkedIn posts in a curator/newsletter style.
Analyze this GitHub repository metadata and README, then produce a ready-to-post draft.

Repo: https://github.com/${owner}/${repo}
Language: ${language || 'Unknown'}
Description: ${description || 'N/A'}
README (excerpt):
${truncatedReadme}

Format requirements:
1. Hook line: 1 punchy sentence highlighting what problem it solves.
2. Summary (2-3 sentences): What it is and why it was built.
3. Key features & what it does (3-4 concise bullet points).
4. Why developers care (1 punchy takeaway).
5. Call to action + repo link: https://github.com/${owner}/${repo}
6. 3-5 relevant hashtags.

Tone: informative, direct, developer-focused, no corporate buzzwords or excessive hype.`;

  return {
    contents: [
      {
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };
}

export function extractGeminiText(apiResponse) {
  try {
    return apiResponse.candidates[0].content.parts[0].text;
  } catch (err) {
    throw new Error(`Failed to parse Gemini response: ${err.message}`);
  }
}