# PromptCraft

PromptCraft 是一款基于 Tauri 的本地桌面 AI 提示词打磨工具。它把常用提示词框架、对话历史、提示词收藏和自定义框架管理放在一个轻量的桌面应用里，适合写作、产品设计、代码辅助、运营文案和日常 AI 工作流。

## 核心功能

- 本地桌面应用：基于 Tauri 2 + React，数据保存在本机。
- AI 提示词打磨：围绕用户输入自动组织系统提示词并调用 OpenAI 兼容接口。
- 框架选择：支持自动框架模式，也支持手动选择适合的提示词框架。
- 自定义框架：可以新增、保存和删除自己的提示词模板。
- 多轮对话：保存对话标题、消息历史和关联框架。
- 提示词库：可保存、搜索、复制和删除常用提示词。
- API Key 本地加密：API Key 会以加密形式保存在本机配置文件中。

## 下载

源码最新版本：v0.2.1

- Release 页面：[PromptCraft Releases](https://github.com/lcolpitr-ui/promptcraft/releases)
- Windows 用户请在 Release 页面下载最新的安装包或便携版资产。
- v0.2.1 修复已合入源码；Windows 安装包需要重新构建后发布。

如果 Windows 弹出安全提示，请确认文件来自本仓库的 Release 页面后再运行。

## API 配置

PromptCraft 支持 OpenAI 兼容的 Chat Completions 接口，例如 DeepSeek、OpenAI 以及其他兼容服务。

在“设置”页面填写：

- API Key：你的服务商 API Key。
- API 端点：可以填写基础地址，也可以填写完整聊天接口地址。
- 模型：服务商支持的模型名。

常用配置示例：

```text
DeepSeek
API 端点: https://api.deepseek.com
模型: deepseek-chat

OpenAI
API 端点: https://api.openai.com
模型: gpt-4o-mini
```

程序会自动补全常见 Chat Completions 路径：

- `https://api.deepseek.com` 会自动请求 `https://api.deepseek.com/chat/completions`
- `https://api.openai.com` 会自动请求 `https://api.openai.com/v1/chat/completions`
- 已经填写完整 `/chat/completions` 地址时，程序会直接使用该地址

## 本地数据

PromptCraft 的数据保存在本机，包括：

- 对话历史
- 提示词库
- 自定义框架
- 设置文件

Windows 上设置文件位于：

```text
%APPDATA%\promptcraft\settings.json
```

应用数据库保存在 Tauri 的 app data 目录中。

## 开发

### 环境要求

- Node.js 18+
- Rust 1.77+
- Visual Studio Build Tools（Windows）

### 安装依赖

```bash
npm install
```

Windows PowerShell 如果禁止运行 `npm.ps1`，可以使用：

```bash
npm.cmd install
```

### 启动开发模式

```bash
npm run tauri dev
```

或：

```bash
npm.cmd run tauri dev
```

### 构建前端

```bash
npm run build
```

### 构建桌面应用

```bash
npm run tauri build
```

构建完成后，安装包会生成在：

```text
src-tauri/target/release/bundle/
```

## 项目结构

```text
promptcraft/
├─ src/                  React 前端
│  ├─ components/        UI 组件
│  ├─ stores/            Zustand 状态管理
│  └─ lib/               AI、框架和提示词工具
├─ src-tauri/            Tauri / Rust 后端
│  ├─ src/               Rust 源码
│  └─ Cargo.toml         Rust 依赖
├─ public/               静态资源
├─ package.json          Node 依赖和脚本
└─ README.md
```

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 桌面端：Tauri 2
- 后端：Rust
- 状态管理：Zustand
- 本地数据库：SQLite
- UI 图标：Lucide React

## 常见问题

### 填了 DeepSeek 但无法调用怎么办？

请确认 API Key、模型名和账户额度有效。API 端点可以填写 `https://api.deepseek.com`，程序会自动补全请求路径。

### 为什么保存设置失败？

API 端点必须使用 HTTPS。开发时允许 `http://localhost`。

### 为什么 PowerShell 里 `npm run build` 报执行策略错误？

这是 Windows PowerShell 的脚本执行策略限制。可以改用 `npm.cmd run build`。

## 许可

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request，一起改进 PromptCraft。
