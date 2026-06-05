# PromptCraft 🎨


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
