export type Env = {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GEMINI_API_KEY: string;
  GITHUB_TOKEN?: string;
  TRENDHUB_STATE: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> };
};

export type RepoResult = {
  owner: string;
  repo: string;
  language: string;
  starsToday: string;
  totalStars: string;
  whatItIs: string;
  whatItDoes: string[];
};

export type TelegramCallbackQuery = {
  id: string;
  message?: {
    chat: { id: number };
  };
  data?: string;
};

export type TelegramMessage = {
  chat: { id: number };
  text?: string;
};

export type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};