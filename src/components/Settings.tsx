import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore, type DataBackup } from "../stores/appStore";
import { Save, Eye, EyeOff, Check, AlertCircle, Download, Upload } from "lucide-react";

export function Settings() {
  const { settings, loadSettings, updateSettings, exportData, importData } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [dataStatus, setDataStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings().then(() => {
        setLocalSettings(useAppStore.getState().settings);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  // 使用 useCallback 避免不必要的重渲染
  const handleSettingsChange = useCallback((updates: Partial<typeof localSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMessage("");

    const success = await updateSettings(localSettings);

    if (success) {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      setSaveStatus("error");
      setErrorMessage("保存失败，请检查配置后重试");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // 验证 Endpoint 格式
  const isValidEndpoint = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.hostname === "localhost";
    } catch {
      return false;
    }
  };

  const endpointWarning = localSettings.apiEndpoint && !isValidEndpoint(localSettings.apiEndpoint)
    ? "建议使用 HTTPS 端点以确保安全"
    : "";

  const handleExportData = async () => {
    try {
      const backup = await exportData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `promptcraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDataStatus("数据已导出，API Key 未包含在备份中。");
    } catch (error) {
      console.error("Failed to export data:", error);
      setDataStatus(`导出失败：${error}`);
    }
  };

  const validateBackup = (value: unknown): value is DataBackup => {
    if (!value || typeof value !== "object") return false;
    const backup = value as Partial<DataBackup>;
    return Array.isArray(backup.conversations)
      && Array.isArray(backup.prompts)
      && Array.isArray(backup.custom_frameworks)
      && !!backup.settings;
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateBackup(parsed)) {
        throw new Error("备份文件格式无效");
      }
      parsed.settings.api_key = "";
      const result = await importData(parsed, importMode);
      setDataStatus(`导入完成：${result.conversations} 个会话，${result.prompts} 条提示词，${result.custom_frameworks} 个自定义框架。`);
    } catch (error) {
      console.error("Failed to import data:", error);
      setDataStatus(`导入失败：${error}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold text-wrap-anywhere">设置</h1>
      </div>

      <div className="min-w-0 w-full max-w-2xl flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={localSettings.apiKey}
              onChange={(e) => handleSettingsChange({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full pr-10 px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-wrap-anywhere">
            支持 OpenAI、Claude、Deepseek 等兼容 OpenAI 格式的 API
          </p>
          <p className="text-xs text-muted-foreground text-wrap-anywhere">
            API Key 使用系统凭据存储保存；settings.json 和数据导出文件不会包含 API Key。设备账号被他人访问时仍可能通过系统凭据读取，请注意本机账号安全。
          </p>
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API 端点</label>
          <input
            type="text"
            value={localSettings.apiEndpoint}
            onChange={(e) => handleSettingsChange({ apiEndpoint: e.target.value })}
            placeholder="https://api.deepseek.com"
            className={`w-full px-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
              endpointWarning ? "border-yellow-500" : "border-input"
            }`}
          />
          {endpointWarning && (
            <p className="text-xs text-yellow-500 text-wrap-anywhere">{endpointWarning}</p>
          )}
          <p className="text-xs text-muted-foreground text-wrap-anywhere">
            可填写基础地址，程序会自动补全 chat/completions：
            <br />
            DeepSeek: https://api.deepseek.com
            <br />
            OpenAI: https://api.openai.com 或 https://api.openai.com/v1/chat/completions
          </p>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-sm font-medium">模型</label>
          <input
            type="text"
            value={localSettings.model}
            onChange={(e) => handleSettingsChange({ model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground text-wrap-anywhere">
            推荐模型：gpt-4o-mini, claude-3-haiku, deepseek-chat
          </p>
        </div>

        {/* AI parameters */}
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium">AI 参数</h2>
            <p className="mt-1 text-xs text-muted-foreground text-wrap-anywhere">
              这些参数会随每次 AI 请求发送到 OpenAI-compatible 服务。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Temperature</label>
              <span className="text-xs text-muted-foreground">{localSettings.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.temperature}
              onChange={(e) => handleSettingsChange({ temperature: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground text-wrap-anywhere">
              越低越稳定，越高越发散。建议提示词打磨使用 0.3 - 0.8。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max output tokens</label>
              <input
                type="number"
                min="1"
                max="128000"
                value={localSettings.maxTokens}
                onChange={(e) => handleSettingsChange({ maxTokens: Number(e.target.value) || 2000 })}
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Request timeout 秒</label>
              <input
                type="number"
                min="5"
                max="300"
                value={localSettings.requestTimeoutSecs}
                onChange={(e) => handleSettingsChange({ requestTimeoutSecs: Number(e.target.value) || 60 })}
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <label className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={localSettings.enableStreaming}
              onChange={(e) => handleSettingsChange({ enableStreaming: e.target.checked })}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block font-medium">启用流式输出</span>
              <span className="block text-xs text-muted-foreground text-wrap-anywhere">
                当前 Tauri 命令链路会使用非流式兼容 fallback，设置会先保存并随请求传递，后续可接入真正流式渲染。
              </span>
            </span>
          </label>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-sm font-medium">语言</label>
          <select
            value={localSettings.language}
            onChange={(e) => handleSettingsChange({ language: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Local data */}
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium">本地数据</h2>
            <p className="mt-1 text-xs text-muted-foreground text-wrap-anywhere">
              可导出会话、提示词库、自定义框架和非敏感设置。API Key 不会导出。
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <button
              onClick={handleExportData}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Download className="h-4 w-4" />
              导出数据
            </button>

            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as "merge" | "overwrite")}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="merge">合并导入</option>
              <option value="overwrite">覆盖导入</option>
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Upload className="h-4 w-4" />
              导入数据
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
          </div>

          {dataStatus && <p className="text-xs text-muted-foreground text-wrap-anywhere">{dataStatus}</p>}
        </div>

        {/* Save button */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              saveStatus === "success"
                ? "bg-green-500 text-white"
                : saveStatus === "error"
                ? "bg-red-500 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            }`}
          >
            {saveStatus === "success" ? (
              <Check className="w-4 h-4" />
            ) : saveStatus === "error" ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveStatus === "saving"
              ? "保存中..."
              : saveStatus === "success"
              ? "已保存"
              : saveStatus === "error"
              ? "保存失败"
              : "保存设置"}
          </button>
          {saveStatus === "success" && (
            <span className="min-w-0 text-sm text-green-500 text-wrap-anywhere">设置保存成功！</span>
          )}
          {saveStatus === "error" && errorMessage && (
            <span className="min-w-0 text-sm text-red-500 text-wrap-anywhere">{errorMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
