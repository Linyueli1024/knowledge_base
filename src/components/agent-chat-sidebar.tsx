"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCheck,
  CornerDownLeft,
  LoaderCircle,
  Paperclip,
  Sparkles,
  StopCircle,
} from "lucide-react";

import { AgentMarkdownContent } from "@/components/agent-markdown-content";
import { Button } from "@/components/ui/button";
import { requestAgentCompletion } from "@/lib/agent-api";
import {
  AGENT_SETTINGS_UPDATED_EVENT,
  AgentSettings,
  defaultAgentSettings,
  loadAgentSettings,
} from "@/lib/agent-settings";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  status?: "done" | "streaming" | "error";
};

const QUICK_PROMPTS = [
  "总结一下这篇笔记的内容",
  "帮我整理并补充这篇笔记",
  "帮我解释一下这篇笔记中的代码",
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "assistant-intro",
    role: "assistant",
    content:
      "右侧 agent 已准备好。填入模型配置后，我会带着当前打开笔记的上下文发起真实请求，并以打字流的形式展示回答。",
    status: "done",
  },
];

type AgentChatSidebarProps = {
  activePath?: string | null;
  noteContent?: string;
};

export function AgentChatSidebar({
  activePath = null,
  noteContent = "",
}: AgentChatSidebarProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isResponding, setIsResponding] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(defaultAgentSettings);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typewriterTimerRef = useRef<number | null>(null);
  const pendingTextRef = useRef("");
  const activeAssistantIdRef = useRef<string | null>(null);

  const conversationMessages = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "assistant-intro")
        .filter((message) => message.status !== "error")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [messages, isResponding]);

  useEffect(() => {
    setSettings(loadAgentSettings());

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AgentSettings>;
      setSettings(customEvent.detail ?? loadAgentSettings());
    };

    window.addEventListener(AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => window.removeEventListener(AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (typewriterTimerRef.current !== null) {
        window.clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  const flushTypewriter = () => {
    if (typewriterTimerRef.current !== null) {
      window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    const messageId = activeAssistantIdRef.current;
    const pending = pendingTextRef.current;
    if (!messageId || !pending) return;

    pendingTextRef.current = "";
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${pending}` }
          : message,
      ),
    );
  };

  const startTypewriter = () => {
    if (typewriterTimerRef.current !== null) {
      return;
    }

    typewriterTimerRef.current = window.setInterval(() => {
      const messageId = activeAssistantIdRef.current;
      if (!messageId) return;

      if (!pendingTextRef.current) {
        return;
      }

      const chunk = pendingTextRef.current.slice(0, 3);
      pendingTextRef.current = pendingTextRef.current.slice(3);

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, content: `${message.content}${chunk}` }
            : message,
        ),
      );
    }, 18);
  };

  const finishAssistantMessage = (status: ChatMessage["status"] = "done") => {
    flushTypewriter();

    const messageId = activeAssistantIdRef.current;
    if (!messageId) return;

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, status, content: message.content || (status === "error" ? "请求失败。" : "") }
          : message,
      ),
    );

    activeAssistantIdRef.current = null;
  };

  const submitMessage = async (rawValue?: string) => {
    const nextValue = (rawValue ?? draft).trim();
    if (!nextValue || isResponding) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: nextValue,
      status: "done",
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
    };

    setDraft("");
    setIsResponding(true);
    setMessages((current) => [...current, userMessage, assistantPlaceholder]);
    pendingTextRef.current = "";
    activeAssistantIdRef.current = assistantId;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    startTypewriter();

    const contextPrefix = settings.includeWorkspaceContext
      ? [
          activePath ? `当前文件: ${activePath}` : "当前文件: 未选中文件",
          noteContent ? `当前内容:\n${noteContent.slice(0, 12000)}` : "当前内容: 空",
        ].join("\n\n")
      : "";

    try {
      await requestAgentCompletion(
        settings,
        [
          {
            role: "system",
            content: settings.systemRules,
          },
          ...(contextPrefix
            ? [
                {
                  role: "system" as const,
                  content: contextPrefix,
                },
              ]
            : []),
          ...conversationMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: nextValue,
          },
        ],
        {
          onToken: (token) => {
            pendingTextRef.current += token;
          },
        },
        abortRef.current.signal,
      );

      finishAssistantMessage("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        finishAssistantMessage("done");
        return;
      }

      const message = error instanceof Error ? error.message : "请求失败，请检查模型配置或网络连接。";
      pendingTextRef.current += `\n[Error] ${message}`;
      finishAssistantMessage("error");
    } finally {
      setIsResponding(false);
    }
  };

  const stopResponse = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    finishAssistantMessage("done");
    setIsResponding(false);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground">
                <Bot className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Agent</p>
                <p className="text-xs text-muted-foreground">Claude Code / Codex 风格侧栏</p>
              </div>
            </div>
          </div>

          <div className="rounded-full border border-sidebar-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
            {settings.model || settings.provider}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("inline-flex size-2 rounded-full", isResponding ? "bg-amber-500" : "bg-emerald-500")} />
          {isResponding ? "正在流式生成回答" : `${settings.provider} 已连接当前上下文`}
        </div>

        {activePath ? (
          <p className="mt-2 truncate text-[11px] text-muted-foreground">上下文: {activePath}</p>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {message.role === "user" ? "You" : "Agent"}
              {message.role === "assistant" ? (
                <>
                  <span className="text-border">•</span>
                  {message.status === "error" ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertCircle className="size-3.5" />
                      请求失败
                    </span>
                  ) : message.status === "streaming" ? (
                    <span className="inline-flex items-center gap-1">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      正在输入
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CheckCheck className="size-3.5" />
                      上下文已同步
                    </span>
                  )}
                </>
              ) : null}
            </div>

            {message.role === "user" ? (
              <div className="rounded-2xl border border-sidebar-border bg-background px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            ) : (
              <article
                className={cn(
                  "w-full border-b border-sidebar-border/70 pb-5",
                  message.status === "error" && "text-destructive",
                )}
              >
                <AgentMarkdownContent
                  content={message.content || (message.status === "streaming" ? " " : "")}
                />
              </article>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-full border border-sidebar-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => void submitMessage(prompt)}
              disabled={isResponding}
            >
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                {prompt}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-sidebar-border bg-background shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            placeholder="给 agent 发消息，描述你想修改、解释或生成的内容..."
            className="min-h-28 w-full resize-none bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Paperclip className="size-3.5" />
              当前会附带文件路径与正文上下文
            </div>

            {isResponding ? (
              <Button size="sm" variant="outline" onClick={stopResponse}>
                停止
                <StopCircle className="size-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => void submitMessage()} disabled={!draft.trim()}>
                发送
                <CornerDownLeft className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
