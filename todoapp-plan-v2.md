# TodoApp 深度规划方案 v2.0

> 更新日期：2026-06-02
> 版本定位：从"能用的 demo"升级为"值得信任的专业工具"

---

## 一、可行性与核心结论

**所有需求均可行，无技术障碍。** 唯一需要验证的需求是 PDF 导出功能——经过调研，结论如下：

### PDF 导出的市场需求（Reddit 调研摘要）

| 调研渠道 | 结论 | 置信度 |
|----------|------|--------|
| r/productivity、r/WindowsAppAdvice、r/todoapp 等社区 | 用户对**数据备份和可迁移性**有强烈需求，但**原生 PDF 导出不是主流诉求** | 中高 |
| 主流竞品（TickTick、Todoist、Things 3）的功能优先级 | 导出功能普遍存在，但以 **JSON/CSV** 为主，PDF 导出多为付费高级功能 | 高 |
| Windows 原生应用生态 | 大多数用户更习惯用"另存为 PDF"（系统级打印对话框）而非内置 PDF 生成 | 高 |

**结论：PDF 导出的直接需求弱，但数据可迁移性是强需求。建议采用以下策略：**

- **主要方案**：内置 JSON / CSV 导出（满足数据可迁移性）
- **锦上添花**：提供 Claude 风格的 PDF 导出模板（轻量实现，用 `@react-pdf/renderer`），作为差异化亮点
- **导出模板**：固定格式，预留用户可修改的填写区，参照 Claude 官网视觉（珊瑚色 + 奶油色 + Inter 字体）

---

## 二、框架与插件选择标准

| 筛选维度 | 最低门槛 | 推荐门槛 |
|----------|----------|----------|
| GitHub Stars | ≥ 1,000 ⭐ | ≥ 5,000 ⭐ |
| 最近更新时间 | 6 个月内 | 3 个月内 |
| Tauri 官方认证 | 优先（官方维护） | 必选核心 Plugin |
| npm 周下载量 | ≥ 10,000 | ≥ 100,000 |
| TypeScript 支持 | 必须 | 必须 |

---

## 三、优化后的完整技术栈

### 后端（Tauri v2 + Rust）

| 类别 | 库 / Plugin | Stars ⭐ | 用途 | 官方维护 |
|------|------------|----------|------|----------|
| 核心框架 | Tauri v2 | 75,000+ | 应用框架 | ✅ 官方 |
| 开机自启 | `@tauri-apps/plugin-autostart` | — | 注册 Windows 自启项 | ✅ 官方 |
| 系统通知 | `@tauri-apps/plugin-notification` | — | Toast 弹窗 | ✅ 官方 |
| 持久化存储 | `@tauri-apps/plugin-store` | — | 用户偏好（语言/主题/路径） | ✅ 官方 |
| 数据库 | `@tauri-apps/plugin-sql` | — | SQLite CRUD | ✅ 官方 |
| 文件系统 | `@tauri-apps/plugin-fs` | — | 导出文件保存 | ✅ 官方 |
| 对话框 | `@tauri-apps/plugin-dialog` | — | 文件路径选择器 | ✅ 官方 |
| 窗口状态 | `@tauri-apps/plugin-window-state` | — | 记住窗口位置 | ✅ 官方 |
| 全局快捷键 | `@tauri-apps/plugin-global-shortcut` | — | 用户自定义热键 | ✅ 官方 |

### 前端（React 18 + TypeScript）

| 类别 | 库 | Stars ⭐ | npm 周下载 | 用途 |
|------|------|----------|-----------|------|
| 核心框架 | React 18 + TypeScript 5 | — | 最高 | 应用框架 |
| 样式系统 | Tailwind CSS 4 | 80,000+ | 极高 | Anthropic 风格还原 |
| 状态管理 | Zustand 5 | 30,000+ | 高 | 轻量状态管理 |
| 国际化 | i18next + react-i18next | 10,000+ | 高 | 中英文切换 |
| 动画 | Framer Motion 11 | 30,000+ | 高 | 流畅动画效果 |
| 日期处理 | date-fns 3 | 极高 | 极高 | 截止时间计算 |
| PDF 生成 | `@react-pdf/renderer` | 10,000+ | 中高 | Claude 风格 PDF 模板 |
| 数据导出 | 纯 JS（JSON/CSV，无需第三方） | — | — | JSON/CSV 导出 |
| 图标 | Lucide React | 极高 | 极高 | 统一图标风格 |
| 字体 | Inter（Google Fonts / fontsource） | — | — | Anthropic 原版字体 |

---

## 四、功能模块详细设计

### 4.1 核心待办功能（保持简洁）

**两种待办类型：**

- **临时待办（Quick）**：无截止时间，按创建时间倒序排列，最大化简洁性
- **长时待办（Long-term）**：设置截止时间+时间（可选），按截止时间升序排列

**卡片交互规范：**

- 点击圆形复选框 → 完成态（文字灰化+删除线）
- hover 卡片 → 右侧显示删除按钮（✕）
- 右键 / 长按 → 编辑菜单（修改标题、切换类型、设置截止时间）
- 拖拽排序（临时待办区可用 @dnd-kit 实现）

**排序逻辑：**

```
临时待办：按创建时间倒序（最新在上）
长时待办：按截止时间升序（最近截止在上）
  → 已过期的：置顶并高亮红色
  → 24小时内截止的：置顶并高亮珊瑚色
```

### 4.2 开机弹窗流程（优化版）

```
用户开机 → 5分钟后触发（时间可配置）→ Toast 通知
  ├→ "开启 TodoApp" → 打开主窗口
  ├→ "稍后提醒（30分钟）" → 静默，30分钟后再弹
  └→ "不再提醒" → 今日内不再弹窗（数据标记）
```

**数据存储（tauri-plugin-store）：**
```json
{
  "startupDelay": 5,       // 分钟
  "remindAgainDelay": 30,  // 分钟
  "lastStartupPromptDate": "2026-06-02",
  "reminderIgnoredToday": false
}
```

### 4.3 截止提醒逻辑（强化版）

```
每次开机弹窗触发时 + 每小时定时扫描
  → 24小时内截止 → Toast 弹窗（"⚠ 任务即将截止：xxx"）
  → 已过期未完成 → Toast 弹窗（"❌ 任务已过期：xxx"）
  → 弹窗后自动标记"已提醒"，当天不重复
```

### 4.4 专业功能模块

#### 设置面板（抽屉式 / 模态框）

| 设置项 | 类型 | 说明 |
|--------|------|------|
| 语言 | 下拉选择 | 中文 / English |
| 主题 | 开关切换 | 日间模式 / 夜间模式（立即生效） |
| 开机延迟 | 滑块 | 1-30 分钟可调 |
| 全局快捷键 | 输入框 | 默认 Ctrl+Shift+T，按钮可重新录制 |
| 下载路径 | 路径选择器 | 点击打开系统文件夹选择器 |
| 数据备份 | 按钮 | 一键备份 JSON 到指定路径 |
| 数据导入 | 按钮 | 从指定 JSON 文件导入 |
| 关于 | 链接 | 版本号 + 开源许可 |

#### 全局快捷键

- 默认：`Ctrl + Shift + T`（可在设置中修改）
- 按下热键 → 聚焦/呼出主窗口
- 使用 `tauri-plugin-global-shortcut` 实现

#### 数据本地备份

- **备份格式**：JSON（包含所有待办 + 偏好设置）
- **备份策略**：
  - 用户可手动触发备份（设置面板）
  - 每次主窗口关闭时自动后台备份（可选开启）
  - 备份文件命名：`todoapp-backup-YYYY-MM-DD.json`
- **导入功能**：检测 JSON 格式，校验后导入，冲突处理策略：合并 or 覆盖

### 4.5 导出功能

#### JSON / CSV 导出（主要）

- **导出路径**：用户可在设置中预设默认路径（`tauri-plugin-dialog`）
- **文件名**：`todoapp-export-YYYY-MM-DD.json` / `.csv`
- **CSV 字段**：`id, title, type, deadline, completed, created_at`

#### PDF 导出（锦上添花）

**Claude 风格 PDF 模板设计：**

```
┌──────────────────────────────────────────┐
│  ●  TodoApp                              │  ← 珊瑚色圆点 Logo
│                                          │
│  ═══════════════════════════════════════ │
│  待办事项报告 · Generated: 2026-06-02     │  ← 副标题
│  ═══════════════════════════════════════ │
│                                          │
│  ▸ 临时待办 (3)                           │  ← 分组标题
│    ☐ Buy groceries after work             │
│    ☐ Reply to Sarah's email              │
│                                          │
│  ▸ 长时待办 (2)                           │
│    ☐ Submit quarterly report   [Due:Today]│
│    ☐ Book flight to Shanghai [Due:Jun 10]│
│                                          │
│  ═══════════════════════════════════════ │
│  Total: 5 items · Completed: 1          │  ← 页脚统计
└──────────────────────────────────────────┘
```

**设计规范（Claude 官网风格）：**
- 背景：奶油色 `#FAF9F7`
- Logo：珊瑚色圆点 `#D97757`
- 标题字体：Inter Bold，18pt
- 正文字体：Inter Regular，12pt
- 分隔线：1px `#E5E3DF`
- 完成项：文字灰化 + 删除线
- 紧急项：珊瑚色高亮截止时间

**实现方案：**
- 使用 `@react-pdf/renderer`（Stars 10,000+，维护活跃）在浏览器端直接生成 PDF Blob，无需服务器
- 提供固定模板，用户仅修改标题内容即可生成专属报告
- PDF 文件名：`TodoApp-Report-YYYY-MM-DD.pdf`

---

## 五、UI/UX 优化方案

### 5.1 专业质感提升

**目标：让用户感觉"这不是一个人随手写的小工具，而是认真设计过的专业产品"**

| 维度 | 改进前（平平无奇） | 改进后（专业质感） |
|------|------------------|------------------|
| 字体 | 系统默认 sans-serif | **Inter**（Google Fonts），字重区分（Regular 400 / Semibold 600 / Bold 700） |
| 间距系统 | 随意 padding | 8px 为基础单位的网格系统（8/16/24/32/48） |
| 色彩层次 | 单一灰色 | 5 层灰阶（背景/卡片/边框/次要文字/主要文字）+ 珊瑚色高亮 |
| 阴影 | 无 | 卡片 hover 时使用极轻阴影 `0 2px 8px rgba(0,0,0,0.06)` |
| 圆角 | 4px 随意圆角 | 统一 12px（大卡片）/ 8px（小元素）/ 4px（标签） |
| 输入框 | 灰边框 | 聚焦时边框变珊瑚色，有细腻过渡动画 |
| 状态反馈 | 无过渡 | 所有交互（hover/点击/切换）都有 150-200ms 过渡动画 |
| 空状态 | 空白 | 有插图 + 引导文案："还没有待办事项，开始添加第一个吧" |

### 5.2 Anthropic 设计语言详解

```
主色调：#D97757（珊瑚橘红）
  → 用于：Logo、完成态、紧急高亮、重要按钮、hover 高亮边框

亮色模式背景：#FAF9F7（Anthropic 官网奶油白）
暗色模式背景：#1A1814（Anthropic 官网深炭黑）

字体层级：
  H1（页面标题）：Inter Bold 20px
  H2（分组标题）：Inter Semibold 14px uppercase letter-spacing:0.5px
  Body（卡片文字）：Inter Regular 14px
  Caption（时间标签）：Inter Medium 12px
  Badge（计数）：Inter Semibold 11px
```

### 5.3 设置面板设计

采用抽屉式侧边栏（从右侧滑入），不会遮挡主界面：

```
┌────────────────────────────────┬─────────────────┐
│         主窗口                   │   设置面板      │
│  [TodoApp Logo]    [⚙ 设置]    │  ┌───────────┐  │
│                                │  │  语言       │  │
│  + 添加待办...                   │  │  主题       │  │
│                                │  │  开机延迟    │  │
│  ● QUICK           3 项        │  │  快捷键     │  │
│  ┌──────────────────┐          │  │  下载路径   │  │
│  │ ☐ 买菜           │          │  │  数据备份   │  │
│  └──────────────────┘          │  │  导出PDF   │  │
│                                │  │  关于       │  │
│  ● LONG-TERM       2 项        │  └───────────┘  │
│  ┌──────────────────┐          │                 │
│  │ ☐ 提交报告  [今日]│          │                 │
│  └──────────────────┘          │                 │
└────────────────────────────────┴─────────────────┘
```

---

## 六、项目目录结构

```
todoapp/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # 入口 + plugin 注册
│   │   ├── lib.rs               # Rust 命令（IPC bridge）
│   │   ├── database.rs          # SQLite 初始化 + 迁移
│   │   └── reminder.rs          # 定时扫描 + 提醒逻辑
│   ├── tauri.conf.json          # Tauri 配置（窗口/通知/权限）
│   ├── capabilities/            # Tauri v2 权限配置
│   └── Cargo.toml
│
├── src/
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 根组件 + 路由
│   ├── components/
│   │   ├── Header.tsx           # 顶栏（Logo + 控制按钮）
│   │   ├── SettingsDrawer.tsx   # 设置面板（侧边抽屉）
│   │   ├── AddTodoBar.tsx       # 输入栏
│   │   ├── TodoCard.tsx         # 单个待办卡片
│   │   ├── TodoSection.tsx      # 分组区块（Quick / Long-term）
│   │   ├── EmptyState.tsx       # 空状态插图
│   │   ├── LanguageSwitcher.tsx # 语言切换
│   │   ├── ThemeToggle.tsx      # 日夜切换
│   │   └── ToastNotification.tsx # 通知弹窗组件
│   ├── store/
│   │   ├── todoStore.ts         # Zustand：待办 CRUD
│   │   └── settingsStore.ts     # Zustand：用户偏好
│   ├── lib/
│   │   ├── tauri.ts             # Tauri IPC 封装
│   │   ├── db.ts                # SQLite 操作层
│   │   ├── pdf-export.tsx      # PDF 生成逻辑
│   │   └── csv-export.ts       # CSV 导出逻辑
│   ├── i18n/
│   │   ├── index.ts             # i18next 初始化
│   │   ├── en.json              # 英文翻译
│   │   └── zh.json              # 中文翻译
│   └── styles/
│       └── globals.css          # CSS 变量 + Tailwind 扩展
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── CLAUDE.md
```

---

## 七、开发里程碑（5-6 天 → 精化为 8 天）

| 阶段 | 内容 | 产出物 |
|------|------|--------|
| **Day 1** | 项目初始化（Tauri v2 + React + Tailwind + Inter 字体） | 可运行空壳 App |
| **Day 2-3** | 核心 UI（Header / 卡片 / 输入框 / 主题切换 / 语言切换） | 静态界面 |
| **Day 4** | 后端 SQLite CRUD + Zustand 状态管理 + i18n | 数据层完成 |
| **Day 5** | 开机自启 + 托盘图标 + 通知弹窗 + 截止提醒 | 系统集成 |
| **Day 6** | 设置面板（下载路径/快捷键/备份/导入） | 专业功能 |
| **Day 7** | PDF + JSON/CSV 导出 | 差异化功能 |
| **Day 8** | 视觉抛光 + 空状态 + 动画优化 + 测试打包 | 交付版 |

---

## 八、风险与备选方案

| 风险点 | 概率 | 应对方案 |
|--------|------|----------|
| Tauri v2 WebView2 在 Win10 不兼容 | 低（Win11 用户） | Win10 用户提示升级或使用 Electron fallback |
| `@react-pdf/renderer` 体积较大 | 中 | 若打包体积超标，改用轻量方案：服务端生成 PDF Blob URL 或纯图片导出 |
| 全局快捷键与其他软件冲突 | 低 | 允许用户自定义，检测冲突时提示 |
| SQLite 在 macOS/Linux 上的兼容 | 无（仅 Win11） | N/A |
| PDF 导出功能用户实际使用率低 | 中 | 降低实现优先级，作为可选功能默认隐藏 |