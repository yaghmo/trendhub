# TrendHub

GitHub Trending → Telegram digest → LinkedIn draft. Every 3 days at 08:00 UTC (top 2 weekly trending) plus 1st + 15th at 08:00 UTC (top 3 monthly trending), or paste any `github.com/owner/repo` link — overview with stars + language, then `✅ Draft Post` / `❌ Skip`. Repos already sent, Drafted or Skipped are remembered and excluded from future digests — paste the link yourself to bypass.

## Stack (all free)

| Component | Service | Notes |
|-----------|---------|-------|
| Runner | Cloudflare Workers | Cron `0 8 */3 * *` (weekly, 2 repos) + `0 8 1,15 * *` (monthly, 3 repos) + `POST /webhook`, 100k req/day, sleeps idle |
| State | Cloudflare KV (`TRENDHUB_STATE`) | Tracks Drafted/Skipped repos, excluded from future digests |
| Alt runner | n8n (`workflows/*.json`) | Self-hosted free, Cloud trial |
| Messaging | Telegram Bot API | `@BotFather`, inline keyboards |
| Data | GitHub API / scraper | Trending + `README.md` (8K chars) |
| LLM | Gemini `gemini-3.5-flash-lite` | 500 req/day free |

## Setup

### 1. Telegram bot
1. Chat `@BotFather` → `/newbot` → pick name + username ending `bot`.
2. Copy token `123456789:AAE...` → `TELEGRAM_BOT_TOKEN`.
3. Chat your bot once (bots cannot initiate).
4. Chat `@userinfobot` → copy `Id` → `TELEGRAM_CHAT_ID`.

### 2. Gemini key
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key → `GEMINI_API_KEY`.
2. Model `gemini-3.5-flash-lite` (500/day, enough here).

### 3. GitHub token (optional)
Only if hitting 60/hour anon limit.
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate, no scopes.
2. Use as `Authorization: Bearer <token>` (Worker: `GITHUB_TOKEN`).

### 4a. Cloudflare Worker (recommended)
```bash
npm install -g wrangler && wrangler login
cd worker && npx wrangler deploy   # note https://trendhub-worker.<you>.workers.dev
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GITHUB_TOKEN  # optional
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://trendhub-worker.<you>.workers.dev/webhook"
```
Crons fire automatically. Check: `npx wrangler tail`.

### 4b. n8n alternative
1. n8n Cloud → Credentials → Telegram → paste BotFather token → Save as `Telegram Bot`.
2. Settings → Variables: add `TELEGRAM_CHAT_ID`, `GEMINI_API_KEY`.
3. Import `workflows/daily-digest.json` + `workflows/draft-generator.json`, re-select Telegram credential on each Telegram node, Save + Activate.

## Usage
- Digest: 3 Telegram messages, each repo with stars/language + overview + `✅ Draft Post` / `❌ Skip`.
- Trigger draft: click `✅ Draft Post` or paste `https://github.com/owner/repo`.
- Flow: `Processing … ⏳` → Gemini summary → LinkedIn draft posted to same chat.
- Clicking `✅ Draft Post` or `❌ Skip` marks that repo seen in KV — won't reappear in future digests. Pasting the link manually always works, seen or not.

## Verify
```bash
npm test          # 18 tests, no network
cd worker && npx tsc --noEmit
```

## Troubleshooting
- No message → chat bot first (Telegram blocks bot-initiated).
- `chat not found` → wrong `TELEGRAM_CHAT_ID`, re-check `@userinfobot`.
- Gemini 400 → key missing / wrong model, regenerate.
- Gemini 429 → rate limit, wait.
- GitHub 403 → add `GITHUB_TOKEN`.
- Buttons dead → Workflow B not active / webhook not set.

## Project files
- `worker/src/*` — Worker (`index.ts`, `scraper.ts`, `prompt_builder.ts`, `telegram.ts`)
- `workflows/*.json` — n8n exports (legacy alt)
- `tests/*` — parser + workflow JSON tests
