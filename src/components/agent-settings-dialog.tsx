"use client";

import { useMemo, useState } from "react";
import { Check, Cpu, KeyRound, Puzzle, Settings2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentSettings,
  MODEL_PROVIDER_PRESETS,
  defaultAgentSettings,
  loadAgentSettings,
  saveAgentSettings,
} from "@/lib/agent-settings";

function SettingsField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Textarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export function AgentSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(defaultAgentSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const skillCount = useMemo(
    () => settings.skills.split("\n").map((item) => item.trim()).filter(Boolean).length,
    [settings.skills],
  );
  const selectedPreset = useMemo(
    () => MODEL_PROVIDER_PRESETS.find((preset) => preset.provider === settings.provider),
    [settings.provider],
  );

  const openDialog = (nextOpen: boolean) => {
    if (nextOpen) {
      setSettings(loadAgentSettings());
    }
    setOpen(nextOpen);
  };

  const updateField = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applyProviderPreset = (provider: string) => {
    const preset = MODEL_PROVIDER_PRESETS.find((item) => item.provider === provider);
    if (!preset) {
      updateField("provider", provider);
      return;
    }

    setSettings((current) => ({
      ...current,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.models.some((model) => model === current.model) ? current.model : preset.models[0],
    }));
  };

  const applyModelPreset = (model: string) => {
    setSettings((current) => ({ ...current, model }));
  };

  const handleSave = () => {
    saveAgentSettings(settings);
    setSavedAt(new Date().toLocaleTimeString());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" className="shrink-0">
          <Settings2 className="size-4" />
          <span className="sr-only">Open agent settings</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[min(960px,calc(100vw-2rem))] overflow-hidden p-0 sm:max-w-[960px]">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Agent Settings</DialogTitle>
          <DialogDescription>
            配置和 Cursor 类似的 agent 参数，包括模型连接、规则、skills 与 MCP 服务器。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="model" className="max-h-[78vh] min-h-[600px] overflow-hidden md:flex-row md:gap-0" orientation="vertical">
          <TabsList variant="line" className="flex w-full shrink-0 flex-row gap-2 overflow-x-auto border-b bg-muted/30 px-4 py-3 md:h-auto md:w-[220px] md:flex-col md:border-b-0 md:border-r md:px-3 md:py-4">
            <TabsTrigger value="model">
              <Cpu className="size-4" />
              模型
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Wrench className="size-4" />
              规则
            </TabsTrigger>
            <TabsTrigger value="skills">
              <Puzzle className="size-4" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="mcp">
              <KeyRound className="size-4" />
              MCP
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="model" className="mt-0 space-y-6">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium">DeepSeek 推荐填写方式</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  如果你现在准备用 DeepSeek，建议填写:
                  <span className="ml-1 font-medium text-foreground">Provider = DeepSeek</span>
                  ，
                  <span className="ml-1 font-medium text-foreground">
                    Base URL = https://api.deepseek.com
                  </span>
                  ，模型选择
                  <span className="ml-1 font-medium text-foreground">deepseek-chat</span>
                  或
                  <span className="ml-1 font-medium text-foreground">deepseek-reasoner</span>。
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <SettingsField
                  label="Provider"
                  description="可填写 OpenAI、Anthropic，或者任何 OpenAI-compatible 网关。"
                >
                  <div className="space-y-3">
                    <select
                      value={settings.provider}
                      onChange={(event) => applyProviderPreset(event.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {MODEL_PROVIDER_PRESETS.map((preset) => (
                        <option key={preset.provider} value={preset.provider}>
                          {preset.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      {MODEL_PROVIDER_PRESETS.map((preset) => (
                        <button
                          key={preset.provider}
                          type="button"
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                          onClick={() => applyProviderPreset(preset.provider)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </SettingsField>

                <SettingsField
                  label="Model"
                  description="右侧聊天区会优先展示这里配置的当前模型。"
                >
                  <div className="space-y-3">
                    <select
                      value={settings.model}
                      onChange={(event) => applyModelPreset(event.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {(selectedPreset?.models ?? [settings.model]).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>

                    <Input
                      value={settings.model}
                      onChange={(event) => updateField("model", event.target.value)}
                      placeholder="deepseek-chat"
                    />

                    {selectedPreset?.models?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedPreset.models.map((model) => (
                          <button
                            key={model}
                            type="button"
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            onClick={() => applyModelPreset(model)}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </SettingsField>
              </div>

              <SettingsField
                label="API Key"
                description="保存到本地浏览器存储。等接入真实调用后，这里可以直接用于连接大模型。"
              >
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(event) => updateField("apiKey", event.target.value)}
                  placeholder="sk-..."
                />
              </SettingsField>

              <div className="grid gap-6 md:grid-cols-[1fr_160px]">
                <SettingsField
                  label="Base URL"
                  description="支持官方接口，也支持兼容 OpenAI 协议的代理地址。"
                >
                  <Input
                    value={settings.baseUrl}
                    onChange={(event) => updateField("baseUrl", event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </SettingsField>

                <SettingsField
                  label="Temperature"
                  description="通常代码助手建议保持在 0.0 到 0.4。"
                >
                  <Input
                    value={settings.temperature}
                    onChange={(event) => updateField("temperature", event.target.value)}
                    placeholder="0.2"
                  />
                </SettingsField>
              </div>
            </TabsContent>

            <TabsContent value="rules" className="mt-0 space-y-6">
              <SettingsField
                label="System Rules"
                description="这里可以写 agent 的全局规则、代码风格偏好、上下文优先级，和 Cursor 的 Rules 类似。"
              >
                <Textarea
                  value={settings.systemRules}
                  onChange={(event) => updateField("systemRules", event.target.value)}
                  className="min-h-60"
                  placeholder="例如：优先使用 TypeScript；修改前先读上下文；不要破坏已有布局。"
                />
              </SettingsField>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input"
                  checked={settings.includeWorkspaceContext}
                  onChange={(event) => updateField("includeWorkspaceContext", event.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium">自动附带当前工作区上下文</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    后续接真实 agent 时，可以默认携带当前文件、打开 tab 和最近编辑内容。
                  </p>
                </div>
              </label>
            </TabsContent>

            <TabsContent value="skills" className="mt-0 space-y-6">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium">Skills 列表</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  一行一个 skill，可用于声明工作流、编码风格或特定领域能力。当前共 {skillCount} 项。
                </p>
              </div>

              <Textarea
                value={settings.skills}
                onChange={(event) => updateField("skills", event.target.value)}
                className="min-h-72"
                placeholder={"前端 UI\n代码解释\n重构建议\n测试生成"}
              />
            </TabsContent>

            <TabsContent value="mcp" className="mt-0 space-y-6">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium">MCP Servers</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  这里支持维护 MCP 配置草稿，推荐按 JSON 结构保存，便于后续直接接入真实 server 管理。
                </p>
              </div>

              <Textarea
                value={settings.mcpServers}
                onChange={(event) => updateField("mcpServers", event.target.value)}
                className="min-h-72 font-mono text-[13px]"
                placeholder='{"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}}'
              />

              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input"
                  checked={settings.autoRunMcp}
                  onChange={(event) => updateField("autoRunMcp", event.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium">允许 agent 自动调用 MCP</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    先作为 UI 配置保存，后续接入真实工具执行权限时可以直接复用。
                  </p>
                </div>
              </label>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {savedAt ? (
              <>
                <Check className="size-3.5" />
                已保存于 {savedAt}
              </>
            ) : (
              "设置会保存到本地浏览器存储"
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setSettings(defaultAgentSettings)}
            >
              恢复默认
            </Button>
            <Button onClick={handleSave}>保存设置</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
