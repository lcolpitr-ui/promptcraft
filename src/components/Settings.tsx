import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { Save, Eye, EyeOff, Check } from "lucide-react";

export function Settings() {
  const { settings, loadSettings, updateSettings } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold">设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl">
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={localSettings.apiKey}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, apiKey: e.target.value })
              }
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
          <p className="text-xs text-muted-foreground">
            支持 OpenAI、Claude、Deepseek 等兼容 OpenAI 格式的 API
          </p>
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API 端点</label>
          <input
            type="text"
            value={localSettings.apiEndpoint}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, apiEndpoint: e.target.value })
            }
            placeholder="https://api.openai.com/v1/chat/completions"
            className="w-full px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            常用端点：
            <br />
            OpenAI: https://api.openai.com/v1/chat/completions
            <br />
            Deepseek: https://api.deepseek.com/v1/chat/completions
          </p>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-sm font-medium">模型</label>
          <input
            type="text"
            value={localSettings.model}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, model: e.target.value })
            }
            placeholder="gpt-4o-mini"
            className="w-full px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            推荐模型：gpt-4o-mini, claude-3-haiku, deepseek-chat
          </p>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-sm font-medium">语言</label>
          <select
            value={localSettings.language}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, language: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "已保存" : "保存设置"}
          </button>
          {saved && (
            <span className="text-sm text-green-500">设置保存成功！</span>
          )}
        </div>
      </div>
    </div>
  );
}
