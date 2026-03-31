import type { AgentSettings } from "@/lib/agent-settings";

type AgentRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StreamHandlers = {
  onToken: (token: string) => void;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractDeltaText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  if (!firstChoice) return "";

  const delta = firstChoice.delta as Record<string, unknown> | undefined;
  if (delta && typeof delta.content === "string") {
    return delta.content;
  }

  const message = firstChoice.message as Record<string, unknown> | undefined;
  if (message && typeof message.content === "string") {
    return message.content;
  }

  return "";
}

export async function requestAgentCompletion(
  settings: AgentSettings,
  messages: AgentRequestMessage[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  if (!settings.apiKey.trim()) {
    throw new Error("请先在设置里填写 API Key。");
  }

  const response = await fetch(buildEndpoint(settings.baseUrl), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: Number(settings.temperature || 0.2),
      stream: true,
    }),
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(rawError || `请求失败 (${response.status})`);
  }

  if (!response.body) {
    const payload = (await response.json()) as Record<string, unknown>;
    const content = extractDeltaText(payload);
    if (content) {
      handlers.onToken(content);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        const payload = parseJsonSafely(data);
        if (!payload) continue;

        const token = extractDeltaText(payload);
        if (token) {
          handlers.onToken(token);
        }
      }
    }
  }
}
