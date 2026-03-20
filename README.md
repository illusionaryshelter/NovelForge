# NovelForge 📖

**网文创作工具** — 时间线、人物、世界观、剧情、章节一体化管理

NovelForge 是一款面向网络小说作者的桌面端创作工具，基于 Electron + React + SQLite 构建，提供富文本编辑器和可视化管理界面，帮助作者管理复杂的角色关系、时间线和剧情。

## ✨ 功能特性

### 📝 章节管理
- 卷/章两级结构，拖拽排序
- TipTap 富文本编辑（加粗、斜体、标题、列表等）
- 自动保存 + 未保存切换警告
- 版本历史管理

### 👤 角色管理
- 角色档案（描述、别名、头像）
- 阵营系统（动态变更历史）
- 境界/战力等级追踪
- 动机随时间线变化
- 角色出场频率统计热力图

### 🔗 关系图谱
- Cytoscape.js 交互式关系网络
- 时间轴滑块过滤关系
- 关系类型分类着色
- 双击节点跳转角色档案

### ⏳ 时间线
- 多时间线并行管理
- 事件-角色关联
- 按时间/角色筛选事件
- 章节-事件关联

### 🌍 世界观
- 分类管理（地理、政治、文化等）
- 树形层级结构
- 地图图片管理

### 🛠 辅助功能
- 全局搜索（Ctrl+K）
- 分屏对照模式
- 快捷键速查（Ctrl+/）
- 标签/书签系统
- 底部状态栏（字数统计+保存状态）
- 最近编辑章节快速跳转
- 回收站（软删除恢复）
- 数据库备份/恢复
- 自定义数据存储路径

---

## 🖥 技术栈

| 层 | 技术 |
|-------|------|
| 框架 | Electron 33 + electron-vite |
| 前端 | React 18 + TypeScript + Ant Design 5 |
| 编辑器 | TipTap (ProseMirror) |
| 状态 | Zustand |
| 数据库 | better-sqlite3 (SQLite, WAL 模式) |
| 图谱 | Cytoscape.js |
| 拖拽 | @dnd-kit |
| 打包 | electron-builder |

---

## 📦 安装与开发

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Python 3** + **C++ 编译工具链**（用于编译 better-sqlite3 原生模块）

**Linux (Debian/Ubuntu):**
```bash
sudo apt install build-essential python3
```

**Windows:**
```powershell
# 安装 windows-build-tools（管理员 PowerShell）
npm install -g windows-build-tools
# 或者安装 Visual Studio Build Tools
```

### 克隆与安装

```bash
git clone https://github.com/<your-username>/NovelForge.git
cd NovelForge
npm install
```

### 开发运行

```bash
npm run dev
```

启动后自动打开 Electron 窗口，修改代码后热重载生效。

### 生产构建

```bash
npm run build
```

---

## 📦 跨平台打包

### Linux (AppImage)

```bash
# 构建 + 打包当前架构
npm run dist

# 指定架构
npx electron-builder --linux --arm64
npx electron-builder --linux --x64
```

生成文件位于 `release/` 目录：
- `NovelForge-x.x.x-arm64.AppImage` — ARM64
- `NovelForge-x.x.x-x86_64.AppImage` — x86_64

**用户使用方式：**
```bash
chmod +x NovelForge-*.AppImage
./NovelForge-*.AppImage
```
> AppImage 是单文件可执行程序，用户无需安装任何依赖，双击即运行。

### Windows (安装版 + 便携版)

> ⚠️ **必须在 Windows 环境下打包**（因为 better-sqlite3 是原生 C++ 模块，需要目标平台编译）

```powershell
npm run dist
```

生成文件位于 `release/` 目录：
- `NovelForge-x.x.x-Setup.exe` — NSIS 安装程序
- `NovelForge-x.x.x-Portable.exe` — 便携版（解压即用）

### macOS (DMG)

```bash
npx electron-builder --mac
```

### GitHub Actions 自动打包（推荐）

可配置 CI 在 Windows + Linux + macOS 三平台自动构建并发布 Release，参见 `.github/workflows/` 目录。

---

## 📁 项目结构

```
NovelForge/
├── electron/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 入口 + IPC 注册
│   │   └── database/      # SQLite 数据库层
│   │       ├── connection.ts   # 连接管理 + 性能优化
│   │       ├── schema.ts       # 表结构定义
│   │       └── migrations.ts   # 版本迁移
│   └── preload/           # preload 安全桥接
├── src/
│   ├── components/        # React 组件
│   │   ├── chapter/       # 编辑器相关
│   │   ├── character/     # 角色相关
│   │   └── layout/        # 布局（AppLayout）
│   ├── pages/             # 页面（路由级）
│   ├── stores/            # Zustand 状态管理
│   └── styles/            # 全局 CSS
├── electron-builder.yml   # 打包配置
└── package.json
```

---

## 🗃 数据存储

- 每个项目独立一个 `.novelforge` 文件（SQLite 数据库）
- 项目索引存放在系统用户数据目录
- 支持自定义数据存储路径
- 支持数据库备份/恢复

---

## 📄 License

MIT
