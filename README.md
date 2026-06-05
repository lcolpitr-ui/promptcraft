# PromptCraft 🎨

PromptCraft 是一个基于 Tauri 的 AI 提示词打磨工具，支持本地桌面使用、提示词库管理和框架管理。

## 📥 下载

最新版本：**v0.2.0**

- **推荐安装包（Windows）**：[PromptCraft_0.2.0_x64_en-US.msi](https://github.com/lcolpitr-ui/promptcraft/releases/download/v0.2.0/PromptCraft_0.2.0_x64_en-US.msi)
- **便携版（Windows）**：[app.exe](https://github.com/lcolpitr-ui/promptcraft/releases/download/v0.2.0/app.exe)
- **Release 页面**：[PromptCraft v0.2.0](https://github.com/lcolpitr-ui/promptcraft/releases/tag/v0.2.0)

> 如果 Windows 弹出安全提示，请确认文件来源为本仓库 Release 页面后再运行。

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

构建完成后，安装包会生成在 `src-tauri/target/release/bundle/` 目录下。

### 项目结构

```text
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
