export const AGENT_SETTINGS_STORAGE_KEY = "knowledge-base-agent-settings";
export const AGENT_SETTINGS_UPDATED_EVENT = "knowledge-base-agent-settings-updated";

export const MODEL_PROVIDER_PRESETS = [
  {
    label: "OpenAI",
    provider: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
  },
  {
    label: "Anthropic",
    provider: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-5", "claude-opus-4-1"],
  },
  {
    label: "DeepSeek",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    label: "OpenAI Compatible",
    provider: "OpenAI Compatible",
    baseUrl: "https://api.openai.com/v1",
    models: ["custom-model"],
  },
] as const;

export type AgentSettings = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: string;
  systemRules: string;
  skills: string;
  mcpServers: string;
  autoRunMcp: boolean;
  includeWorkspaceContext: boolean;
};

export const defaultAgentSettings: AgentSettings = {
  provider: "OpenAI Compatible",
  model: "gpt-5",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  temperature: "0.2",
  systemRules:
    "你是当前知识库应用里的代码助手。优先参考当前打开文件、工作区上下文和用户最近的意图进行回答。",
  skills: ["代码解释", "重构建议", "生成组件", "修复类型问题"].join("\n"),
  mcpServers: `{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
  }
}`,
  autoRunMcp: true,
  includeWorkspaceContext: true,
};

export function loadAgentSettings(): AgentSettings {
  if (typeof window === "undefined") {
    return defaultAgentSettings;
  }

  const saved = window.localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY);
  if (!saved) {
    return defaultAgentSettings;
  }

  try {
    return {
      ...defaultAgentSettings,
      ...(JSON.parse(saved) as Partial<AgentSettings>),
    };
  } catch {
    return defaultAgentSettings;
  }
}

export function saveAgentSettings(settings: AgentSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(AGENT_SETTINGS_UPDATED_EVENT, { detail: settings }));
}
