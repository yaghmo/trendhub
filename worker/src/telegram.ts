function mdBoldToHtml(text: string): string {
  // escape HTML first, then convert **bold** → <b>bold</b>
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export async function sendTelegram(
  env: { TELEGRAM_BOT_TOKEN: string },
  params: {
    chatId: string | number;
    text: string;
    replyMarkup?: unknown;
    plainText?: boolean;
  }
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const html = params.plainText ? params.text : mdBoldToHtml(params.text);
  const body: Record<string, unknown> = {
    chat_id: String(params.chatId),
    text: html,
    parse_mode: "HTML",
  };
  if (params.replyMarkup) {
    body.reply_markup = params.replyMarkup;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${txt}`);
  }
}

export async function deleteMessage(
  env: { TELEGRAM_BOT_TOKEN: string },
  params: { chatId: string | number; messageId: number }
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: String(params.chatId),
      message_id: params.messageId,
    }),
  });
}

export async function answerCallbackQuery(
  env: { TELEGRAM_BOT_TOKEN: string },
  params: { callbackQueryId: string; text?: string }
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id: params.callbackQueryId,
      text: params.text || "",
    }),
  });
}

export async function editMessageReplyMarkup(
  env: { TELEGRAM_BOT_TOKEN: string },
  params: { chatId: string | number; messageId: number; replyMarkup: unknown }
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: String(params.chatId),
      message_id: params.messageId,
      reply_markup: params.replyMarkup,
    }),
  });
}