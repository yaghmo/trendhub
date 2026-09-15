import { parseTrending } from "./scraper.js";
import { buildOverviewPayload, buildGeminiPayload, extractGeminiText } from "./prompt_builder.js";
import { sendTelegram, answerCallbackQuery, editMessageReplyMarkup } from "./telegram.js";
import type { Env, TelegramUpdate } from "./types.js";

const GITHUB_TRENDING = "https://github.com/trending?since=daily";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/webhook") {
      const update = (await request.json()) as TelegramUpdate;
      ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error(e)));
      return new Response("ok");
    }

    if (url.pathname === "/health") return new Response("ok");
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runDigest(env));
  },
};

async function runDigest(env: Env): Promise<void> {
  const res = await fetch(GITHUB_TRENDING, {
    headers: { "user-agent": "trendhub-worker/1.0" },
  });
  if (!res.ok) throw new Error(`trending fetch ${res.status}`);
  const html = await res.text();
  const repos = parseTrending(html, 3);

  for (let i = 0; i < repos.length; i++) {
    const overview = await generateOverview(repos[i].owner, repos[i].repo, env);
    await sendTelegram(env, {
      chatId: env.TELEGRAM_CHAT_ID,
      text: overview,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "✅ Draft Post", callback_data: `draft:${repos[i].owner}/${repos[i].repo}` },
            { text: "❌ Skip", callback_data: `skip:${repos[i].owner}/${repos[i].repo}` },
          ],
        ],
      },
    });
  }
}

function isAllowedChat(chatId: number | string, env: Env): boolean {
  return String(chatId) === String(env.TELEGRAM_CHAT_ID);
}

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  if (update.callback_query?.data) {
    const data = update.callback_query.data;
    const cb = update.callback_query;
    const chatId = cb.message?.chat.id ?? env.TELEGRAM_CHAT_ID;
    const msgId = (cb.message as unknown as { message_id?: number })?.message_id;
    if (!isAllowedChat(chatId, env)) {
      await answerCallbackQuery(env, { callbackQueryId: cb.id, text: "Not authorized." });
      return;
    }
    if (msgId != null) {
      await editMessageReplyMarkup(env, { chatId, messageId: msgId, replyMarkup: { inline_keyboard: [] } });
    }
    await answerCallbackQuery(env, { callbackQueryId: cb.id });

    if (data.startsWith("skip:")) {
      await sendTelegram(env, { chatId, text: `Skipped ${data.slice(5)}.` });
      return;
    }

    if (data.startsWith("draft:")) {
      const slug = data.slice(6);
      const [owner, repo] = slug.split("/");
      if (!owner || !repo) return;
      await sendTelegram(env, { chatId, text: `Processing ${owner}/${repo} ⏳` });
      const draft = await generateDraft(owner, repo, env);
      await sendTelegram(env, { chatId, text: draft });
      return;
    }
  }

  // manual GitHub URL — same 2-stage: overview via Gemini then buttons
  const text = update.message?.text?.trim();
  if (!text) return;
  if (!isAllowedChat(update.message!.chat.id, env)) return;
  const m = /github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/.exec(text);
  if (!m) return;

  const chatId = update.message!.chat.id;
  const [, owner, repo] = m;
  const overview = await generateOverview(owner, repo, env);
  await sendTelegram(env, {
    chatId,
    text: overview,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "✅ Draft Post", callback_data: `draft:${owner}/${repo}` },
          { text: "❌ Skip", callback_data: `skip:${owner}/${repo}` },
        ],
      ],
    },
  });
}

async function fetchRepoContext(owner: string, repo: string, env: Env) {
  const headers: Record<string, string> = { accept: "application/vnd.github.v3+json", "user-agent": "trendhub-worker/1.0" };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

  let description: string | undefined;
  let language: string | undefined;
  let stargazers_count: number | undefined;
  try {
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { description?: string; language?: string; stargazers_count?: number };
      description = meta.description || undefined;
      language = meta.language || undefined;
      stargazers_count = meta.stargazers_count;
    } else {
      console.log(`GitHub meta ${owner}/${repo} ${metaRes.status} ${await metaRes.text().then(s=>s.slice(0,200))}`);
    }
  } catch (e) { console.log(`GitHub meta fetch error ${owner}/${repo} ${String(e).slice(0,200)}`); }

  let readmeText = "";
  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { ...headers, accept: "application/vnd.github.raw" },
    });
    if (readmeRes.ok) readmeText = await readmeRes.text();
  } catch { /* tolerate */ }

  return { description, language, stargazers_count, readmeText };
}

async function callGemini(payload: unknown, env: Env): Promise<string> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!geminiRes.ok) {
    const body = await geminiRes.text();
    throw new Error(`Gemini ${geminiRes.status}: ${body}`);
  }
  const apiJson = await geminiRes.json();
  return extractGeminiText(apiJson);
}

async function generateOverview(owner: string, repo: string, env: Env): Promise<string> {
  const ctx = await fetchRepoContext(owner, repo, env);
  if (ctx.stargazers_count == null || !ctx.language) {
    console.log(`fetchRepoContext ${owner}/${repo} missing`, JSON.stringify({ stargazers_count: ctx.stargazers_count, language: ctx.language }));
  }
  const payload = buildOverviewPayload({ owner, repo, description: ctx.description, language: ctx.language, readmeText: ctx.readmeText, stars: ctx.stargazers_count });
  let overview = await callGemini(payload, env);
  // Override stars/lang line deterministically — Gemini often drops or garbles it.
  const n = ctx.stargazers_count;
  const lang = ctx.language || "Unknown";
  if (n != null) {
    const fmt = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const statsLine = `⭐ **${fmt}** stars | 🌐 ${lang}`;
    if (/⭐.*stars/i.test(overview)) overview = overview.replace(/⭐.*stars[^\n]*/i, statsLine);
    else overview = overview.trimEnd() + `\n\n${statsLine}`;
  } else if (overview.includes("N/A") && lang !== "Unknown") {
    overview = overview.replace(/N\/A/g, lang).replace(/Unknown/g, lang);
  }
  overview += `\n🔗 https://github.com/${owner}/${repo}`;
  return overview;
}

async function generateDraft(owner: string, repo: string, env: Env): Promise<string> {
  const ctx = await fetchRepoContext(owner, repo, env);
  const payload = buildGeminiPayload({ owner, repo, description: ctx.description, language: ctx.language, readmeText: ctx.readmeText, stars: ctx.stargazers_count });
  return callGemini(payload, env);
}
