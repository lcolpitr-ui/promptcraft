# PromptCraft 🎨

AI 提示词打磨工具 - 通过对话式引导，将模糊想法转化为高质量结构化提示词

## 📦 内置框架

| 框架 | 全称 | 适用场景 |
|------|------|----------|
| **CO-STAR** | Context-Objective-Style-Tone-Audience-Response | 写作、营销、内容创作 |
| **CRISPE** | Capacity-Role-Insight-Statement-Personality-Experiment | 创意、角色扮演、头脑风暴 |
| **BROKE** | Background-Role-Objective-Key Results-Evolve | 项目、业务、目标管理 |
| **RODES** | Role-Objective-Details-Examples-Sense Check | 代码开发、技术任务 |
| **APE** | Action-Purpose-Expectation | 简单任务、快速回答 |
| **CARE** | Context-Action-Result-Example | 问题分析、诊断优化 |
| **RISE** | Role-Instructions-Steps-End Goal | 教程、流程、指南 |
| **ERA** | Expectation-Role-Action | 单一明确任务 |

## 🚀 快速开始

### 安装

1. 下载 `PromptCraft.exe` 或 `PromptCraft_0.1.0_x64_en-US.msi`
2. 双击运行即可

### 配置

1. 打开应用后，点击左侧 **设置**
2. 输入你的 API Key（支持 OpenAI、Deepseek 等）
3. 配置 API 端点和模型
4. 点击保存

### 使用

1. 在 **对话** 页面输入你的想法
2. AI 会追问细节，自动匹配框架
3. 生成结构化提示词
4. 可保存到 **提示词库**

## 🛠️ 开发

### 环境要求

- Node.js 18+
- Rust 1.77+
- Visual Studio Build Tools (Windows)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

### 项目结构

```
promptcraft/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── stores/             # Zustand 状态管理
│   └── lib/                # 工具函数
├── src-tauri/              # Rust 后端
│   ├── src/                # Rust 源码
│   └── Cargo.toml          # Rust 依赖
├── package.json            # Node 依赖
└── README.md
```

## 📝 技术栈

- **前端**：React + TypeScript + Vite + Tailwind CSS
- **后端**：Rust + Tauri 2
- **状态管理**：Zustand
- **数据库**：SQLite (本地存储)
- **UI 组件**：Lucide Icons

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系

如有问题，请提交 Issue。
