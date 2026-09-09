/**
 * Puter.js AI Chat — truy cập OpenAI models miễn phí, không cần API key.
 * Dùng SDK browser (https://js.puter.com/v2/), hoạt động trên "User-Pays model":
 * mỗi người dùng tự trả chi phí, developer KHÔNG tốn phí.
 *
 * Models miễn phí: gpt-5.4-nano, gpt-5.6-luna, gpt-6-astra, o4-mini, ...
 * Docs: https://developer.puter.com/tutorials/free-unlimited-openai-api/
 */

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string | Array<{ role: string; content: string }>,
          options?: {
            model?: string;
            stream?: boolean;
            temperature?: number;
            max_tokens?: number;
          },
        ) => Promise<{
          message?: { content: string | Array<{ text?: string }> };
          [key: string]: unknown;
        } | AsyncIterable<{ text?: string }>>;
      };
    };
  }
}

/** Kiểm tra Puter.js SDK đã load chưa. */
export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && !!window.puter?.ai;
}

/**
 * Gửi tin nhắn tới AI qua Puter.js (free, không cần key).
 * Trả về text response hoặc throw error.
 */
export async function puterChat(
  messages: Array<{ role: string; content: string }>,
  model = "gpt-5.4-nano",
): Promise<string> {
  if (!isPuterAvailable()) {
    throw new Error("Puter.js SDK chưa sẵn sàng");
  }

  const response = await window.puter!.ai.chat(messages, {
    model,
    temperature: 0.7,
    max_tokens: 1024,
  });

  // Handle both streaming and non-streaming responses
  if (typeof response === "object" && response !== null && "message" in response) {
    const msg = (response as { message?: { content: string | Array<{ text?: string }> } }).message;
    if (!msg) throw new Error("Puter AI trả về response rỗng");
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map((c) => c.text ?? "").join("");
    }
  }

  // Streaming response — collect all parts
  if (response && typeof response === "object" && Symbol.asyncIterator in response) {
    let text = "";
    for await (const part of response as AsyncIterable<{ text?: string }>) {
      if (part?.text) text += part.text;
    }
    return text;
  }

  throw new Error("Puter AI trả về format không xác định");
}

/**
 * Gửi prompt đơn giản, trả về text.
 */
export async function puterChatSimple(
  prompt: string,
  model = "gpt-5.4-nano",
): Promise<string> {
  return puterChat([{ role: "user", content: prompt }], model);
}
