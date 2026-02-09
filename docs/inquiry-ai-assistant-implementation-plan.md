# Inquiry AI Assistant - 实现方案

> 基于 Chrome Side Panel 的多平台电商客服 AI 助手

## 项目概述

### 这是什么

**Inquiry AI Assistant** 是一个 Chrome 浏览器扩展，以 Side Panel（侧边栏）形式嵌入浏览器，帮助电商客服人员快速处理客户问询。

**核心工作流程**：

1. 客服人员打开电商平台的问询页面（如 Rakuten R-Messe）
2. 扩展自动抓取问询内容（客户姓名、问题、订单号等）
3. 侧边栏中 AI 根据问询上下文生成专业的日语回复
4. 客服人员确认后一键填充回复到页面输入框

**解决的痛点**：

- 客服每天处理大量重复性问询（物流、退款、道歉等），需要手动编写日语回复
- 不同平台（Rakuten、Mercari、Amazon）界面不同，操作碎片化
- 缺乏上下文记忆，多次沟通需要反复查看历史

**产品形态**：Chrome Side Panel（独立侧边栏页面，无 Shadow DOM 隔离问题）

### 目标

- 复刻 [Ant Design X Copilot](https://x.ant.design/docs/playground/copilot-cn) 样式的 AI 助手
- 支持多平台：Rakuten R-Messe → Mercari → Amazon
- 每个问询独立对话上下文
- 抓取页面数据 + AI 生成回复 + 一键填充

### 支持的平台

| 平台 | 页面 | 优先级 | 状态 |
|------|------|--------|------|
| Rakuten R-Messe | `rmesse.rms.rakuten.co.jp` | Phase 6 | 首期实现 |
| Mercari | `mercari.com/mypage/messages` | Phase 10 | 后续扩展 |
| Amazon JP | `sellercentral.amazon.co.jp` | Phase 11 | 后续扩展 |

---

## 技术栈

### 核心依赖

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **构建框架** | WXT | ^0.20.0 | 浏览器扩展开发框架 |
| **UI 框架** | React | ^19.2.3 | 组件化开发 |
| **UI 主库** | antd | ^6.2.2 | 基础 UI 组件 |
| **AI 组件** | @ant-design/x | ^2.2.1 | Bubble, Sender, Prompts 等 |
| **AI SDK** | @ant-design/x-sdk | ^2.2.1 | useXChat, XRequest |
| **Markdown** | @ant-design/x-markdown | ^2.2.1 | 流式友好的 AI Markdown 渲染 |
| **图标** | @ant-design/icons | ^6.1.0 | 图标库 |
| **状态管理** | Zustand | ^5.0.0 | 轻量状态 + 持久化 |
| **样式** | Tailwind CSS | ^4.0.0 | 原子化 CSS |
| **类型** | TypeScript | ^5.9.3 | 类型安全 |
| **日期** | dayjs | ^1.11.19 | 日期处理 |

### Ant Design 生态分工

```
┌─────────────────────────────────────────────────────────────────────┐
│  antd (主库)                                                        │
│  - Layout, Sider, Content           布局                            │
│  - Menu, Tabs                       导航                            │
│  - Card, Typography, Avatar         数据展示                        │
│  - Button, Input, Select, Switch    表单控件                        │
│  - Modal, Drawer, message           反馈                            │
│  - ConfigProvider, theme            主题配置                        │
│  - Tooltip, Popconfirm, Dropdown    交互增强                        │
├─────────────────────────────────────────────────────────────────────┤
│  @ant-design/x (AI 专用组件)                                        │
│  - Bubble / Bubble.List             消息气泡                        │
│  - Sender                           输入框 + 发送                   │
│  - Prompts                          快捷提示                        │
│  - Conversations                    对话列表                        │
│  - Welcome                          欢迎/空状态                     │
│  - ThoughtChain                     思维链展示                      │
│  - XProvider                        全局 AI 上下文                  │
├─────────────────────────────────────────────────────────────────────┤
│  @ant-design/x-sdk (AI 运行时)                                      │
│  - useXChat                         聊天状态管理 Hook               │
│  - useXAgent                        Agent 调用 Hook                 │
│  - XRequest                         流式请求封装                    │
│  - XStream                          SSE 流解析                      │
│  - OpenAIChatProvider               OpenAI 适配器                   │
├─────────────────────────────────────────────────────────────────────┤
│  @ant-design/x-markdown (AI Markdown 渲染)                           │
│  - XMarkdown                       流式友好 Markdown 渲染            │
│  - 内置代码高亮 (CodeHighlighter)   代码块高亮                       │
│  - 内置 Mermaid                    图表渲染                          │
│  - Think 组件                      AI 思考过程展示                   │
│  - 插件系统                        LaTeX 公式等可扩展                │
├─────────────────────────────────────────────────────────────────────┤
│  @ant-design/icons                                                  │
│  - RobotOutlined, UserOutlined, SendOutlined                        │
│  - CopyOutlined, FormOutlined, SettingOutlined                      │
│  - DeleteOutlined, PlusOutlined, etc.                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
inquiry-ai-assistant/
├── src/
│   ├── entrypoints/                # WXT 入口点 (自动识别)
│   │   ├── sidepanel/              # Side Panel 主界面
│   │   │   ├── index.html          # HTML 入口
│   │   │   ├── main.tsx            # React 入口
│   │   │   └── App.tsx             # 主应用组件
│   │   ├── background.ts           # Service Worker
│   │   └── content.ts              # Content Script
│   │
│   ├── assets/                     # CSS、图片等静态资源 (WXT 约定目录)
│   │   └── global.css              # Tailwind + 全局样式
│   │
│   ├── components/                 # UI 组件 (WXT 自动导入 ✅)
│   │   ├── ChatPanel/
│   │   │   ├── index.tsx           # 聊天主面板
│   │   │   ├── MessageBubble.tsx   # 消息气泡
│   │   │   ├── QuickPrompts.tsx    # 快捷操作
│   │   │   └── ContextCard.tsx     # 问询上下文卡片
│   │   ├── ConversationList/
│   │   │   ├── index.tsx           # 对话列表
│   │   │   └── ConversationItem.tsx
│   │   ├── Settings/
│   │   │   ├── index.tsx           # 设置面板
│   │   │   └── ProviderConfig.tsx  # AI Provider 配置
│   │   └── common/
│   │       ├── Header.tsx          # 顶部标题栏
│   │       └── EmptyState.tsx      # 空状态 (Welcome)
│   │
│   ├── extractors/                 # 多平台数据提取器 (需手动 import)
│   │   ├── types.ts                # 统一接口定义
│   │   ├── factory.ts              # 工厂模式
│   │   ├── rakuten.ts              # Rakuten R-Messe
│   │   ├── mercari.ts              # 煤炉 (预留)
│   │   └── amazon.ts               # Amazon (预留)
│   │
│   ├── services/                   # 服务层 (需手动 import)
│   │   ├── ai/
│   │   │   ├── types.ts            # AI 接口类型
│   │   │   ├── provider-factory.ts # Provider 工厂
│   │   │   ├── openai.ts           # OpenAI 实现
│   │   │   ├── gemini.ts           # Gemini 实现
│   │   │   └── custom.ts           # 自定义 API
│   │   └── storage.ts              # chrome.storage 封装
│   │
│   ├── stores/                     # Zustand 状态管理 (需手动 import)
│   │   ├── conversation.ts         # 对话状态 (核心)
│   │   ├── settings.ts             # 设置状态
│   │   └── ui.ts                   # UI 状态
│   │
│   ├── hooks/                      # React Hooks (WXT 自动导入 ✅)
│   │   └── useStreamChat.ts        # 流式对话 Hook
│   │
│   ├── locales/                    # 应用内翻译 (需手动 import)
│   │   ├── zh.ts                   # 中文
│   │   ├── ja.ts                   # 日语 (默认)
│   │   └── en.ts                   # 英语
│   │
│   ├── utils/                      # 工具函数 (WXT 自动导入 ✅)
│   │   ├── i18n.ts                 # 翻译工具 + useI18n Hook
│   │   ├── build-system-prompt.ts  # System Prompt 构建
│   │   └── retry.ts                # 网络请求重试
│   │
│   └── types/                      # TypeScript 类型 (需手动 import)
│       ├── inquiry.ts              # 问询数据类型
│       ├── message.ts              # 消息类型
│       ├── messages.ts             # 通信协议类型
│       └── platform.ts             # 平台类型
│
├── public/
│   ├── _locales/                   # Manifest 本地化 (browser.i18n)
│   │   ├── ja/messages.json        # 日语 (默认)
│   │   ├── zh_CN/messages.json     # 中文
│   │   └── en/messages.json        # 英语
│   ├── icon-16.png                 # WXT 自动发现图标 (匹配 icon-{size}.png)
│   ├── icon-48.png
│   └── icon-128.png
│
├── wxt.config.ts                   # WXT 配置 (srcDir + manifest + vite 插件)
├── tsconfig.json                   # TypeScript 配置 (extends .wxt/tsconfig.json)
├── .env.example                    # 环境变量示例
└── package.json                    # 依赖配置 (含 postinstall: wxt prepare)
```

> **WXT 自动导入说明**:
> WXT 基于 [unimport](https://github.com/unjs/unimport) 自动导入以下目录的所有 named/default export:
> - `src/components/*` ✅
> - `src/hooks/*` ✅
> - `src/utils/*` ✅
>
> 这些目录中的模块**无需手动 `import`**，直接使用即可。
> `stores/`、`extractors/`、`services/`、`types/`、`locales/` 不在自动导入范围内，需要显式 `import`。
>
> 运行 `wxt prepare` 后会生成 `.wxt/` 目录，包含 TypeScript 声明文件和路径别名配置。

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension (MV3)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Side Panel (独立 HTML)                        │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                   App.tsx                                   │  │  │
│  │  │  ┌───────────────────────────────────────────────────────┐  │  │  │
│  │  │  │  ConversationList        │  ChatPanel               │  │  │  │
│  │  │  │  ┌─────────────────────┐ │  ┌─────────────────────┐ │  │  │  │
│  │  │  │  │ 🟢 客户A (活跃)     │ │  │  Bubble.List        │ │  │  │  │
│  │  │  │  │ ⚪ 客户B           │ │  │  (Markdown 渲染)     │ │  │  │  │
│  │  │  │  │ ⚪ 客户C           │ │  ├─────────────────────┤ │  │  │  │
│  │  │  │  └─────────────────────┘ │  │  Prompts            │ │  │  │  │
│  │  │  │                          │  ├─────────────────────┤ │  │  │  │
│  │  │  │                          │  │  Sender             │ │  │  │  │
│  │  │  │                          │  └─────────────────────┘ │  │  │  │
│  │  │  └───────────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────┬──────────────────────────────────┘  │
│                                   │                                      │
│                    chrome.runtime.sendMessage                           │
│                                   │                                      │
│  ┌────────────────────────────────▼──────────────────────────────────┐  │
│  │                   Background Service Worker                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │  │
│  │  │ AI Provider     │  │ Conversation    │  │ Tab Watcher      │   │  │
│  │  │ Manager         │  │ Store           │  │ (监听页面切换)    │   │  │
│  │  │ - OpenAI        │  │ - 按问询ID存储   │  │                  │   │  │
│  │  │ - Gemini        │  │ - 历史记录      │  │                  │   │  │
│  │  │ - Custom        │  │                 │  │                  │   │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                    chrome.tabs.sendMessage                              │
│                                   │                                      │
│  ┌────────────────────────────────▼──────────────────────────────────┐  │
│  │                      Content Scripts                               │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Extractor Factory                        │   │  │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │   │  │
│  │  │  │  Rakuten    │ │   Mercari   │ │   Amazon    │  ...      │   │  │
│  │  │  │  Extractor  │ │  Extractor  │ │  Extractor  │           │   │  │
│  │  │  │             │ │             │ │             │           │   │  │
│  │  │  │ - 抓取问询   │ │ - 抓取问询   │ │ - 抓取问询   │           │   │  │
│  │  │  │ - 填充回复   │ │ - 填充回复   │ │ - 填充回复   │           │   │  │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘           │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户打开问询页面
         │
         ▼
┌─────────────────────────────────────┐
│  Content Script (content.ts)        │
│  1. 检测平台 (Rakuten/Mercari/...)  │
│  2. 调用对应 Extractor              │
│  3. 提取问询数据                    │
└─────────────────┬───────────────────┘
                  │ chrome.runtime.sendMessage
                  ▼
┌─────────────────────────────────────┐
│  Background Service Worker          │
│  1. 接收页面数据                    │
│  2. 通知 Side Panel                 │
└─────────────────┬───────────────────┘
                  │ chrome.runtime.sendMessage
                  ▼
┌─────────────────────────────────────┐
│  Side Panel                         │
│  1. 查找或创建对话 (by inquiryId)   │
│  2. 切换到对应对话上下文             │
│  3. 显示问询信息                    │
└─────────────────────────────────────┘
         │
         │ 用户发送消息
         ▼
┌─────────────────────────────────────┐
│  useXChat Hook                      │
│  1. 构建消息 (含 systemPrompt)      │
│  2. 调用 AI Provider                │
│  3. 流式接收响应                    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  ChatPanel                          │
│  1. Markdown 渲染 AI 回复           │
│  2. 用户点击"填充"按钮              │
└─────────────────┬───────────────────┘
                  │ chrome.tabs.sendMessage
                  ▼
┌─────────────────────────────────────┐
│  Content Script                     │
│  调用 extractor.fillReply()         │
│  填充到页面回复框                   │
└─────────────────────────────────────┘
```

> **补充**：Side Panel 打开时会主动对当前 Tab 发送一次 `REQUEST_EXTRACT`（兜底触发），避免 Side Panel 后打开导致错过 Content Script 的推送。

---

## 核心接口设计

### 问询数据类型

```typescript
// src/types/inquiry.ts
export type Platform = 'rakuten' | 'mercari' | 'amazon'

export interface InquiryData {
  platform: Platform
  inquiryId: string
  customerName: string
  category?: string
  inquiryContent: string
  orderNumber?: string
  receivedTime?: string
  additionalInfo?: Record<string, string>
}
```

### 平台提取器接口

```typescript
// src/extractors/types.ts
export interface PlatformExtractor {
  platform: Platform

  // 检测当前页面是否匹配
  match(url: string): boolean

  // 提取问询数据
  extract(): Promise<InquiryData | null>

  // 填充回复到页面
  fillReply(content: string): Promise<boolean>

  // 获取唯一问询 ID
  getInquiryId(): string | null
}
```

### 对话存储结构

```typescript
// src/stores/conversation.ts
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status?: 'pending' | 'streaming' | 'done' | 'error'
}

interface Conversation {
  id: string                    // 格式: "platform:inquiryId"
  platform: Platform
  inquiryId: string
  customerName: string
  inquiryContent: string
  messages: Message[]
  systemPrompt: string
  createdAt: number
  updatedAt: number
}

interface ConversationStore {
  conversations: Record<string, Conversation>
  activeConversationId: string | null

  // Actions
  setActiveConversation: (id: string | null) => void
  getOrCreateConversation: (data: {
    platform: Platform
    inquiryId: string
    customerName: string
    inquiryContent: string
    systemPrompt: string
  }) => string  // 返回 conversation id

  addMessage: (convId: string, msg: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastAssistantMessage: (convId: string, content: string) => void
  finalizeLastAssistantMessage: (convId: string) => void

  clearConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void

  // 存储上限管理
  MAX_CONVERSATIONS: 100              // 最多保存对话数
  MAX_MESSAGES_PER_CONVERSATION: 50   // 每对话最多消息数
  pruneOldConversations: () => void   // 清理超限对话
}
```

### 消息通信协议

Side Panel / Content Script / Background 之间通过 `chrome.runtime` 通信。

```typescript
// src/types/messages.ts

// ========== Content Script → Background ==========

/** 页面数据提取完成 */
interface InquiryDataMessage {
  type: 'INQUIRY_DATA'
  payload: InquiryData
}

/** 页面 URL 变化 (SPA 路由切换), tabId 由 Background 通过 sender.tab.id 获取 */
interface PageChangedMessage {
  type: 'PAGE_CHANGED'
  payload: { url: string }
}

// ========== Background → Side Panel ==========

/** 通知 Side Panel 问询数据更新 */
interface InquiryUpdatedMessage {
  type: 'INQUIRY_UPDATED'
  payload: InquiryData & { tabId: number }
}

/** 通知 Side Panel：当前 Tab/页面上下文变化（激活切换或 SPA 路由变化） */
interface TabChangedMessage {
  type: 'TAB_CHANGED'
  payload: { tabId: number; url: string }
}

/** 通知 Side Panel Tab 关闭 */
interface TabClosedMessage {
  type: 'TAB_CLOSED'
  payload: { tabId: number }
}

// ========== Side Panel → Background ==========

/** 请求抓取当前页面数据 */
interface RequestExtractMessage {
  type: 'REQUEST_EXTRACT'
  payload: { tabId: number }
}

/** 请求填充回复到页面 */
interface FillReplyMessage {
  type: 'FILL_REPLY'
  payload: { tabId: number; content: string }
}

/** 测试 AI Provider 连接（设置页按钮，建议由 Background 执行） */
interface TestConnectionMessage {
  type: 'TEST_CONNECTION'
  payload?: { apiUrl?: string; apiKey?: string; model?: string }
}

type TestConnectionResponse = { ok: boolean; error?: string }


// ========== 流式 AI 对话 (Port 长连接) ==========

/** Side Panel → Background: 开始流式对话 */
interface StartStreamMessage {
  type: 'START_STREAM'
  payload: {
    messages: Message[]
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

/** Background → Side Panel: 流式响应 */
type StreamResponse =
  | { type: 'STREAM_CHUNK'; content: string }
  | { type: 'STREAM_THINKING'; content: string }    // 思维链
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; error: string }

/** Side Panel → Background: 中断流式 */
interface AbortStreamMessage {
  type: 'ABORT_STREAM'
}

// ========== 聚合类型 ==========

type RuntimeMessage =
  | InquiryDataMessage
  | PageChangedMessage
  | InquiryUpdatedMessage
  | TabChangedMessage
  | TabClosedMessage
  | RequestExtractMessage
  | FillReplyMessage
  | TestConnectionMessage

type PortMessage =
  | StartStreamMessage
  | AbortStreamMessage
  | StreamResponse
```

> **Side Panel 与 Tab 的关联逻辑**: 详见下方 "WXT 配置 → Background Service Worker" 的完整实现。
> Background 维护 `tabInquiryMap`，监听 `chrome.tabs.onActivated` 和 `chrome.tabs.onRemoved`，
> 自动通知 Side Panel 切换对话上下文。

---

## WXT 配置

### wxt.config.ts

```typescript
import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 源码放在 src/ 下，WXT 会在 src/entrypoints/ 中查找入口点
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'ja',
    // 注意:
    // - sidePanel 权限由 WXT 检测到 sidepanel 入口点后自动添加，无需手动声明
    // - side_panel.default_path 也由 WXT 从 entrypoints/sidepanel/index.html 自动生成
    // - dev 模式下 WXT 可能会自动注入额外权限用于 HMR（生产构建请显式声明实际需要的权限）
    permissions: ['storage', 'tabs', 'permissions'],
    host_permissions: [
      'https://*.rakuten.co.jp/*',
      'https://*.mercari.com/*',
      'https://*.amazon.co.jp/*',
    ],
    optional_host_permissions: [
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.zenmux.ai/*',
      // 私有分发/企业版才启用：'https://*/*'（支持任意自定义 API Endpoint）
    ],
    action: {
      default_title: 'Open AI Assistant',
    },
  },
})
```

> **注意**: AI API 域名放在 `optional_host_permissions`，首次使用时动态申请权限，
> 避免 Chrome Web Store 审核因权限过多被拒。
> 
> **自建 Endpoint**: Web Store 版本建议采用“白名单”策略（把你的域名加入 `optional_host_permissions`），不要直接启用 `https://*/*`；如确有需要，可提供企业/私有分发版本再启用泛域名 optional host。

### Content Script 配置 (WXT 风格)

> **关键**: R-Messe 等页面是 SPA，`main()` 只执行一次。
> 必须监听 DOM 变化 / URL 变化才能感知路由切换。

```typescript
// src/entrypoints/content.ts
export default defineContentScript({
  matches: [
    'https://rmesse.rms.rakuten.co.jp/*',
    'https://*.mercari.com/mypage/messages/*',
    'https://sellercentral.amazon.co.jp/*',
  ],
  // ctx: ContentScriptContext - WXT 提供，用于扩展更新时清理资源
  main(ctx) {
    let extractor = ExtractorFactory.create(location.href)
    if (!extractor) return

    let lastInquiryId: string | null = null

    // 尝试提取并发送数据
    async function tryExtract() {
      const data = await extractor?.extract()
      if (data && data.inquiryId !== lastInquiryId) {
        lastInquiryId = data.inquiryId
        chrome.runtime.sendMessage({ type: 'INQUIRY_DATA', payload: data })
      }
    }

    // SPA 路由变化处理：重建 Extractor + 重新提取
    function handleRouteChange() {
      chrome.runtime.sendMessage({
        type: 'PAGE_CHANGED',
        payload: { url: location.href }, // tabId 由 Background 通过 sender.tab.id 获取
      })
      // 路由变化后重建 Extractor（同域不同路由可能结构不同）
      extractor = ExtractorFactory.create(location.href)
      lastInquiryId = null
      if (extractor) tryExtract()
    }

    // 首次提取
    tryExtract()

    // ===== SPA 路由监听 (hook history API，比 MutationObserver 更轻量) =====
    let lastUrl = location.href
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        handleRouteChange()
      }
    }

    // Hook history.pushState / replaceState
    const origPushState = history.pushState.bind(history)
    const origReplaceState = history.replaceState.bind(history)
    history.pushState = (...args) => { origPushState(...args); checkUrlChange() }
    history.replaceState = (...args) => { origReplaceState(...args); checkUrlChange() }

    // 监听浏览器前进/后退
    window.addEventListener('popstate', checkUrlChange)

    // 监听 Background 发来的指令
    const messageHandler = (msg: any, _sender: any, sendResponse: any) => {
      if (msg.type === 'REQUEST_EXTRACT') {
        // Side Panel 请求手动重新提取
        tryExtract()
        return
      }
      if (msg.type === 'FILL_REPLY') {
        extractor?.fillReply(msg.payload.content).then(sendResponse)
        return true // 异步响应
      }
    }
    chrome.runtime.onMessage.addListener(messageHandler)

    // 扩展更新 / content script 失效时清理资源
    ctx.onInvalidated(() => {
      history.pushState = origPushState
      history.replaceState = origReplaceState
      window.removeEventListener('popstate', checkUrlChange)
      chrome.runtime.onMessage.removeListener(messageHandler)
    })
  },
})
```

### Background Service Worker

> **MV3 Service Worker 生命周期注意**: Service Worker 空闲 5 分钟后会被回收。
> 使用 Port 长连接保活：Port 连接期间 Service Worker 不会被回收。
> 对于超长流式响应，Port 本身就是保活机制。

```typescript
// src/entrypoints/background.ts
export default defineBackground(() => {
  // Tab → 问询数据 映射
  const tabInquiryMap = new Map<number, InquiryData>()

  // ===== 监听 Tab 事件 =====
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId)
    const inquiry = tabInquiryMap.get(tabId)

    // 通知 Side Panel 切换上下文
    chrome.runtime.sendMessage({
      type: inquiry ? 'INQUIRY_UPDATED' : 'TAB_CHANGED',
      payload: inquiry
        ? { ...inquiry, tabId }
        : { tabId, url: tab.url ?? '' },
    }).catch(() => {}) // Side Panel 可能未打开
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabInquiryMap.delete(tabId)
    chrome.runtime.sendMessage({
      type: 'TAB_CLOSED',
      payload: { tabId },
    }).catch(() => {})
  })

  // ===== 监听 Runtime 消息 =====
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'INQUIRY_DATA': {
        const tabId = sender.tab?.id
        if (tabId) {
          tabInquiryMap.set(tabId, msg.payload)
          // 转发给 Side Panel
          chrome.runtime.sendMessage({
            type: 'INQUIRY_UPDATED',
            payload: { ...msg.payload, tabId },
          }).catch(() => {})
        }
        break
      }

      case 'PAGE_CHANGED': {
        // Content Script 通知 SPA 路由变化
        const changedTabId = sender.tab?.id
        if (changedTabId) {
          // 清除旧数据，等待新的 INQUIRY_DATA
          tabInquiryMap.delete(changedTabId)

          // 通知 Side Panel：当前 Tab 的页面已变化（用于重置上下文/显示空状态）
          chrome.runtime.sendMessage({
            type: 'TAB_CHANGED',
            payload: { tabId: changedTabId, url: msg.payload.url },
          }).catch(() => {}) // Side Panel 可能未打开

          // 兜底：主动触发一次提取（若 content script 自己已提取，可在 extractor 侧做去重）
          chrome.tabs.sendMessage(changedTabId, { type: 'REQUEST_EXTRACT' }, () => {
            // ignore chrome.runtime.lastError (content script 未注入/尚未就绪等)
          })
        }
        break
      }

      case 'TEST_CONNECTION': {
        // 设置页测试连接（在 Background 中执行，避免 Side Panel 直接 fetch 的 CORS 问题）
        ;(async () => {
          try {
            const settings = await chrome.storage.local.get('inquiry-ai-settings')
            const config = JSON.parse(settings['inquiry-ai-settings'] ?? '{}')?.state ?? {}

            const apiUrl = msg.payload?.apiUrl || config.apiUrl || 'https://api.openai.com/v1'
            const apiKey = msg.payload?.apiKey || config.apiKey || ''
            const model = msg.payload?.model || config.model || 'gpt-4o-mini'

            await ensureOriginPermission(apiUrl)

            const provider = new OpenAICompatibleProvider(apiUrl, apiKey, model)
            const ok = await provider.testConnection()
            sendResponse({ ok })
          } catch (e: any) {
            sendResponse({ ok: false, error: e?.message || 'Connection failed' })
          }
        })()
        return true // 异步
      }

      case 'REQUEST_EXTRACT': {
        // Side Panel 请求手动提取（转发给 Content Script）
        chrome.tabs.sendMessage(
          msg.payload.tabId,
          { type: 'REQUEST_EXTRACT' },
          () => {
            const err = chrome.runtime.lastError
            if (err) sendResponse({ ok: false, error: err.message })
            else sendResponse({ ok: true })
          }
        )
        return true // 异步响应
      }

      case 'FILL_REPLY': {
        // Side Panel → Content Script 填充
        chrome.tabs.sendMessage(
          msg.payload.tabId,
          { type: 'FILL_REPLY', payload: { content: msg.payload.content } },
          (result) => {
            const err = chrome.runtime.lastError
            if (err) sendResponse({ ok: false, error: err.message })
            else sendResponse({ ok: true, result })
          }
        )
        return true // 异步响应
      }
    }
  })

  // ===== Optional Host Permissions（Just-in-time） =====
  // AI API 域名放在 optional_host_permissions 中，真正发请求前再动态申请对应 origin
  function toOriginPattern(baseUrl: string): string {
    const u = new URL(baseUrl)
    return `${u.origin}/*`
  }

  async function ensureOriginPermission(baseUrl: string) {
    let u: URL
    try {
      u = new URL(baseUrl)
    } catch {
      throw new Error('API URL 格式不正确，请输入完整 https URL（如 https://api.openai.com/v1）')
    }
    if (u.protocol !== 'https:') {
      throw new Error('出于安全原因，仅支持 https API 地址')
    }

    const pattern = `${u.origin}/*`
    const has = await chrome.permissions.contains({ origins: [pattern] })
    if (has) return

    const granted = await chrome.permissions.request({ origins: [pattern] })
    if (!granted) {
      throw new Error(`需要授权访问该 AI API 域名：${u.origin}`)
    }
  }

  // ===== 流式 AI 对话 (Port 长连接) =====
  // 每个 Port 连接有独立的 AbortController，互不干扰
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ai_stream') return

    // 当前 Port 的活跃流控制器 (一个 Port 同一时刻只有一个活跃流)
    let currentController: AbortController | null = null

    port.onMessage.addListener(async (msg: PortMessage) => {
      if (msg.type === 'START_STREAM') {
        // 如果当前 Port 已有活跃流，先中断
        currentController?.abort()
        currentController = new AbortController()
        const controller = currentController

        try {
          // 根据 settings store 创建 AI Provider (见 Phase 5 AIProvider 接口)
          const settings = await chrome.storage.local.get('inquiry-ai-settings')
          const config = JSON.parse(settings['inquiry-ai-settings'] ?? '{}')?.state ?? {}
          const apiUrl = config.apiUrl || 'https://api.openai.com/v1'
          await ensureOriginPermission(apiUrl)

          const provider = new OpenAICompatibleProvider(
            apiUrl,
            config.apiKey || '',
            config.model || 'gpt-4o-mini'
          )
          const stream = provider.generateStream(msg.payload.messages, {
            model: msg.payload.model,
            temperature: msg.payload.temperature,
            maxTokens: msg.payload.maxTokens,
            signal: controller.signal,
          })

          for await (const chunk of stream) {
            if (controller.signal.aborted) break
            port.postMessage({ type: 'STREAM_CHUNK', content: chunk })
          }
          if (!controller.signal.aborted) {
            port.postMessage({ type: 'STREAM_DONE' })
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            port.postMessage({ type: 'STREAM_ERROR', error: error.message })
          }
        } finally {
          if (currentController === controller) {
            currentController = null
          }
        }
      }

      if (msg.type === 'ABORT_STREAM') {
        // 只中断当前 Port 的活跃流
        currentController?.abort()
        currentController = null
      }
    })

    port.onDisconnect.addListener(() => {
      // Port 断开时只清理当前 Port 的流
      currentController?.abort()
      currentController = null
    })
  })

  // ===== 点击扩展图标打开 Side Panel =====
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return
    chrome.sidePanel.open({ tabId: tab.id })

    // 兜底：Side Panel 打开时主动触发一次提取
    chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_EXTRACT' }, () => {
      // ignore chrome.runtime.lastError
    })
  })
})
```

---

## 用户界面设计

### Side Panel 布局

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Chrome 浏览器                                                               │
├─────────────────────────────────────────────────┬──────────────────────────┤
│                                                 │  ┌────────────────────┐  │
│   Rakuten R-Messe 问询页面                      │  │ 🤖 AI 客服助手     │  │
│                                                 │  ├────────────────────┤  │
│   ┌─────────────────────────────────────────┐   │  │ 对话列表           │  │
│   │  客户问题内容...                         │   │  │ ┌────────────────┐ │  │
│   │                                         │   │  │ │🟢 田中太郎     │ │  │
│   └─────────────────────────────────────────┘   │  │ │⚪ 山田花子     │ │  │
│                                                 │  │ └────────────────┘ │  │
│                                                 │  ├────────────────────┤  │
│                                                 │  │ 📋 问询上下文      │  │
│                                                 │  │ 客户: 田中太郎     │  │
│                                                 │  │ 类别: 配送问题     │  │
│                                                 │  ├────────────────────┤  │
│                                                 │  │                    │  │
│                                                 │  │ 💬 消息区域        │  │
│                                                 │  │ ┌────────────────┐ │  │
│                                                 │  │ │ AI: 您好...    │ │  │
│                                                 │  │ │ [填充] [复制]  │ │  │
│                                                 │  │ └────────────────┘ │  │
│                                                 │  │                    │  │
│                                                 │  ├────────────────────┤  │
│                                                 │  │ 快捷操作           │  │
│                                                 │  │ [生成回复][道歉]   │  │
│                                                 │  ├────────────────────┤  │
│                                                 │  │ [📝 输入消息...]   │  │
│                                                 │  └────────────────────┘  │
└─────────────────────────────────────────────────┴──────────────────────────┘
```

### 交互流程

1. **打开问询页面** → Content Script 检测并提取数据
2. **点击扩展图标** → Side Panel 打开并自动关联当前问询
3. **选择快捷操作或输入** → AI 生成回复 (流式)
4. **Markdown 渲染** → 显示格式化的回复
5. **点击"填充"** → 回复自动填入页面输入框
6. **切换问询页面** → Side Panel 自动切换对话上下文

---

## 开发计划

| 阶段 | 内容 | 产出 | 优先级 |
|------|------|------|--------|
| **Phase 1** | 项目搭建 | WXT + React 基础框架 | 🔴 高 |
| **Phase 2** | Side Panel 基础 | 空壳界面，可正常打开 | 🔴 高 |
| **Phase 3** | 设置页面 | API 配置 + 语言切换 + 模型选择 | 🔴 高 |
| **Phase 4** | ChatPanel 组件 | Bubble + Sender + Markdown 渲染 | 🔴 高 |
| **Phase 5** | useXChat 集成 | 能与 AI 对话 (流式) | 🔴 高 |
| **Phase 6** | Rakuten Extractor | 抓取问询数据 + 填充回复 | 🔴 高 |
| **Phase 7** | 对话管理 | Zustand + 多对话切换 | 🟡 中 |
| **Phase 8** | 多语言支持 | 中文/日语/英语 国际化 (i18n) | 🟡 中 |
| **Phase 9** | 优化打磨 | UI 细节、错误处理、性能优化 | 🟡 中 |
| **Phase 10** | Mercari Extractor | 煤炉平台支持 | 🟢 低 |
| **Phase 11** | Amazon Extractor | Amazon 平台支持 | 🟢 低 |

> **开发策略**:
> - Phase 1-6 为核心功能，优先完成 Rakuten 平台的完整体验
> - Phase 7-9 为功能完善和打磨
> - Phase 10-11 为平台扩展，在 Rakuten 稳定后再进行

---

### Phase 1: 项目搭建

#### 目标

初始化 WXT + React + Tailwind v4 项目骨架，确保能正常构建和加载。

#### 任务清单

- [ ] 1.1 `pnpm create wxt@latest inquiry-ai-assistant --template react`
- [ ] 1.2 安装核心依赖

```bash
# UI
pnpm add react react-dom antd @ant-design/icons @ant-design/x @ant-design/x-sdk

# 状态管理
pnpm add zustand

# AI Markdown 渲染 (流式友好，Ant Design X 生态)
pnpm add @ant-design/x-markdown

# 工具
pnpm add dayjs

# Tailwind v4
pnpm add -D @tailwindcss/vite

# 类型
pnpm add -D typescript @types/react @types/react-dom @types/chrome
```

- [ ] 1.3 配置 `wxt.config.ts`（含 `srcDir: 'src'` + Tailwind v4 vite 插件）
- [ ] 1.4 配置 `tsconfig.json`（继承 WXT 生成的配置）

```json
// tsconfig.json - WXT 会自动生成 .wxt/tsconfig.json，包含路径别名 @/ → src/
{
  "extends": "./.wxt/tsconfig.json"
}
```

> **注意**: `@/` 路径别名由 WXT 自动配置（基于 `srcDir` 设置）。
> 运行 `wxt prepare`（或 `pnpm postinstall`）会生成 `.wxt/tsconfig.json`，
> 其中包含 `paths` 映射和 auto-import 类型声明。

- [ ] 1.5 在 `package.json` 中添加 `postinstall` 脚本

```json
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "postinstall": "wxt prepare"
  }
}
```

> **重要**: `wxt prepare` 会生成 `.wxt/` 目录，包含 TypeScript 配置和 auto-import 类型声明，
> 确保 IDE 能正确识别 `@/` 路径别名和 WXT 的自动导入。

- [ ] 1.6 创建 `src/assets/global.css`

```css
/* src/assets/global.css - Tailwind v4 CSS-first 配置 */
@import "tailwindcss";

@theme {
  --color-primary: #2478AE;
  --color-primary-hover: #1a5f8f;
}
```

- [ ] 1.7 创建 `.env.example`
- [ ] 1.8 验证 `pnpm dev` 能正常启动 + 热更新

#### 验收标准

- 项目能正常构建为 Chrome 扩展
- `pnpm dev` 能自动打开 Chrome 并加载扩展
- Tailwind class 生效

---

### Phase 2: Side Panel 基础

#### 目标

实现 Side Panel 空壳界面，能通过点击扩展图标打开。

#### 任务清单

- [ ] 2.1 创建 Side Panel 入口

```typescript
// src/entrypoints/sidepanel/index.html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

```typescript
// src/entrypoints/sidepanel/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '@/assets/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] 2.2 创建 App.tsx 主框架

```typescript
// src/entrypoints/sidepanel/App.tsx
import { useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import jaJP from 'antd/locale/ja_JP'
import enUS from 'antd/locale/en_US'
import { XProvider } from '@ant-design/x'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { Spin } from 'antd'

const locales = { zh: zhCN, ja: jaJP, en: enUS }

export function App() {
  const language = useSettingsStore((s) => s.language)
  const themeMode = useSettingsStore((s) => s.theme)
  const hasHydrated = useHasHydrated()

  // Side Panel 打开时，主动请求当前 Tab 的问询数据（避免错过之前 Content Script 的推送）
  useEffect(() => {
    if (!hasHydrated) return
    ;(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        chrome.runtime.sendMessage({
          type: 'REQUEST_EXTRACT',
          payload: { tabId: tab.id },
        }).catch(() => {})
      }
    })()
  }, [hasHydrated])

  // 等待 settings 从 chrome.storage 加载完成
  if (!hasHydrated) {
    return <Spin className="flex items-center justify-center h-screen" />
  }

  return (
    <ConfigProvider
      locale={locales[language]}
      theme={{
        algorithm: themeMode === 'dark'
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        token: { colorPrimary: '#2478AE' },
      }}
    >
      <XProvider>
        {/* Phase 4+ 填充具体页面 */}
        <div className="h-screen flex flex-col">
          <header className="p-3 border-b font-bold">AI 客服助手</header>
          <main className="flex-1 p-4">Side Panel Ready</main>
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
```

- [ ] 2.3 创建 Background 入口（含 Side Panel 打开逻辑）
- [ ] 2.4 验证点击图标能打开 Side Panel

#### 验收标准

- 点击扩展图标能打开 Side Panel
- Side Panel 显示基础布局
- 暗色/亮色主题切换生效
- 无控制台错误

---

### Phase 3: 设置页面详细设计

#### 设置项分类

```
┌─────────────────────────────────────────────────────────────────────┐
│                         设置页面                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🌐 界面设置                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  语言        [中文 ▼]                                   │ │   │
│  │  │  主题        [跟随系统 ▼]  (浅色/深色/跟随系统)          │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🤖 AI 服务配置                                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  服务商      [OpenAI 兼容 ▼]                            │ │   │
│  │  │              (OpenAI / Gemini / 自定义)                  │ │   │
│  │  │                                                         │ │   │
│  │  │  API URL     [https://api.openai.com/v1          ]      │ │   │
│  │  │  API Key     [sk-xxxxxxxxxxxxx                   ] 👁   │ │   │
│  │  │  模型        [gpt-4o ▼]                                 │ │   │
│  │  │              (gpt-4o / gpt-4o-mini / 自定义输入)         │ │   │
│  │  │                                                         │ │   │
│  │  │  [测试连接]                                              │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💬 对话设置                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  Temperature  [0.7]  ──────●────────                    │ │   │
│  │  │  Max Tokens   [4096]                                    │ │   │
│  │  │  流式输出     [✓] 启用                                   │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📝 提示词模板 (可选)                                        │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  系统提示词  [多行文本输入框...]                         │ │   │
│  │  │                                                         │ │   │
│  │  │  [恢复默认]                                              │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                                        [保存设置]  [重置]           │
└─────────────────────────────────────────────────────────────────────┘
```

#### 设置存储结构

```typescript
// src/stores/settings.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'zh' | 'ja' | 'en'
export type Theme = 'light' | 'dark' | 'system'
export type Provider = 'openai' | 'gemini' | 'custom'

export interface SettingsState {
  // 界面设置
  language: Language
  theme: Theme

  // AI 服务配置
  provider: Provider
  apiUrl: string
  apiKey: string
  model: string

  // 对话设置
  temperature: number
  maxTokens: number
  streamEnabled: boolean

  // 提示词模板
  systemPrompt: string

  // Actions
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setProvider: (provider: Provider) => void
  setApiConfig: (config: { apiUrl?: string; apiKey?: string; model?: string }) => void
  setDialogSettings: (settings: { temperature?: number; maxTokens?: number; streamEnabled?: boolean }) => void
  setSystemPrompt: (prompt: string) => void
  resetToDefaults: () => void
}

const defaultSettings = {
  language: 'ja' as Language,
  theme: 'system' as Theme,
  provider: 'openai' as Provider,
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  streamEnabled: true,
  systemPrompt: '',
}

// chrome.storage 适配器 (异步)
const chromeStorageAdapter = {
  getItem: async (name: string) => {
    const result = await chrome.storage.local.get(name)
    return result[name] ?? null
  },
  setItem: async (name: string, value: string) => {
    await chrome.storage.local.set({ [name]: value })
  },
  removeItem: async (name: string) => {
    await chrome.storage.local.remove(name)
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      // hydration 状态 (解决异步 storage 首次渲染闪烁)
      _hasHydrated: false,

      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setProvider: (provider) => {
        const urls: Record<Provider, string> = {
          openai: 'https://api.openai.com/v1',
          gemini: 'https://generativelanguage.googleapis.com/v1beta',
          custom: '',
        }
        set({ provider, apiUrl: urls[provider] })
      },
      setApiConfig: (config) => set((state) => ({ ...state, ...config })),
      setDialogSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'inquiry-ai-settings',
      storage: chromeStorageAdapter,
      // 异步 hydration 完成回调
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hasHydrated: true } as any)
      },
    }
  )
)

// 等待 hydration 完成的 hook
export const useHasHydrated = () =>
  useSettingsStore((s) => (s as any)._hasHydrated ?? false)
```

#### 设置页面组件

```typescript
// src/components/Settings/index.tsx
import { Form, Input, Select, Slider, Switch, Button, message, Tabs } from 'antd'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from '@/utils/i18n'

export function SettingsPanel() {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const [form] = Form.useForm()

  const handleTestConnection = async () => {
    try {
      // 通过 Background 测试连接（避免 Side Panel 直接 fetch 的 CORS 问题）
      const result = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: {
          apiUrl: settings.apiUrl,
          apiKey: settings.apiKey,
          model: settings.model,
        },
      })

      if (result?.ok) {
        message.success(t('connectionSuccess'))
      } else {
        message.error(result?.error || t('connectionFailed'))
      }
    } catch {
      message.error(t('connectionError'))
    }
  }

  return (
    <div className="p-4">
      <Tabs
        items={[
          {
            key: 'interface',
            label: t('interfaceSettings'),
            children: (
              <Form layout="vertical">
                <Form.Item label={t('language')}>
                  <Select
                    value={settings.language}
                    onChange={settings.setLanguage}
                    options={[
                      { value: 'zh', label: '中文' },
                      { value: 'ja', label: '日本語' },
                      { value: 'en', label: 'English' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t('theme')}>
                  <Select
                    value={settings.theme}
                    onChange={settings.setTheme}
                    options={[
                      { value: 'system', label: t('themeSystem') },
                      { value: 'light', label: t('themeLight') },
                      { value: 'dark', label: t('themeDark') },
                    ]}
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'ai',
            label: t('aiSettings'),
            children: (
              <Form layout="vertical">
                <Form.Item label={t('provider')}>
                  <Select
                    value={settings.provider}
                    onChange={settings.setProvider}
                    options={[
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'gemini', label: 'Google Gemini' },
                      { value: 'custom', label: t('customProvider') },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t('apiUrl')}>
                  <Input
                    value={settings.apiUrl}
                    onChange={(e) => settings.setApiConfig({ apiUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </Form.Item>
                <Form.Item label={t('apiKey')}>
                  <Input.Password
                    value={settings.apiKey}
                    onChange={(e) => settings.setApiConfig({ apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </Form.Item>
                <Form.Item label={t('model')}>
                  <Select
                    value={settings.model}
                    onChange={(model) => settings.setApiConfig({ model })}
                    options={[
                      { value: 'gpt-4o', label: 'GPT-4o' },
                      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                    ]}
                    showSearch
                    allowClear
                  />
                </Form.Item>
                <Button onClick={handleTestConnection}>{t('testConnection')}</Button>
              </Form>
            ),
          },
          {
            key: 'dialog',
            label: t('dialogSettings'),
            children: (
              <Form layout="vertical">
                <Form.Item label={`Temperature: ${settings.temperature}`}>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(v) => settings.setDialogSettings({ temperature: v })}
                  />
                </Form.Item>
                <Form.Item label={t('maxTokens')}>
                  <Input
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => settings.setDialogSettings({ maxTokens: Number(e.target.value) })}
                  />
                </Form.Item>
                <Form.Item label={t('streamOutput')}>
                  <Switch
                    checked={settings.streamEnabled}
                    onChange={(v) => settings.setDialogSettings({ streamEnabled: v })}
                  />
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </div>
  )
}
```

#### 应用内语言切换

> i18n 工具函数和翻译数据的完整实现见 **Phase 8: 多语言实现方案**。
> 设置页面中的 `useI18n()` hook 和 `t()` 函数来自 `src/utils/i18n.ts`。
> Ant Design 的 locale 联动已在 Phase 2 的 `App.tsx` 中处理。

---

### Phase 4: ChatPanel 组件

#### 目标

集成 `@ant-design/x` 的 Bubble、Sender、Prompts 组件，实现聊天 UI。

#### 任务清单

- [ ] 4.1 创建 `ChatPanel/index.tsx` 主面板

```typescript
// src/components/ChatPanel/index.tsx
import { Bubble, Sender, Prompts } from '@ant-design/x'
import { RobotOutlined, UserOutlined, CopyOutlined, FormOutlined } from '@ant-design/icons'
import { Button, message, Typography } from 'antd'
import { XMarkdown } from '@ant-design/x-markdown'
import { useI18n } from '@/utils/i18n'
import type { Message } from '@/types/message'

interface ChatPanelProps {
  messages: Message[]
  loading: boolean
  onSend: (content: string) => void
  onAbort: () => void
  onFillReply: (content: string) => void
}

export function ChatPanel({ messages, loading, onSend, onAbort, onFillReply }: ChatPanelProps) {
  const { t } = useI18n()

  // 流式友好的 Markdown 渲染器
  const renderMarkdown = (content: string) => (
    <XMarkdown content={content} />
  )

  // 消息气泡角色配置
  const roles = {
    user: {
      placement: 'end' as const,
      avatar: { icon: <UserOutlined /> },
    },
    assistant: {
      placement: 'start' as const,
      avatar: { icon: <RobotOutlined />, style: { background: '#2478AE' } },
      messageRender: renderMarkdown,
      footer: (msg: Message) => (
        <div className="flex gap-1 mt-1">
          <Button
            size="small"
            type="text"
            icon={<FormOutlined />}
            onClick={() => onFillReply(msg.content)}
          >
            {t('fill')}
          </Button>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(msg.content)
              message.success(t('copied'))
            }}
          >
            {t('copy')}
          </Button>
        </div>
      ),
    },
  }

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        <Bubble.List
          items={messages.map((msg) => ({
            key: msg.id,
            role: msg.role,
            content: msg.content,
            loading: msg.status === 'streaming',
          }))}
          roles={roles}
        />
      </div>

      {/* 快捷操作 */}
      <QuickPrompts onSelect={onSend} />

      {/* 输入框 */}
      <div className="p-3 border-t">
        <Sender
          loading={loading}
          placeholder={t('inputPlaceholder')}
          onSubmit={onSend}
          onCancel={onAbort}
        />
      </div>
    </div>
  )
}
```

- [ ] 4.2 创建 `QuickPrompts.tsx` 快捷操作

```typescript
// src/components/ChatPanel/QuickPrompts.tsx
import { Prompts } from '@ant-design/x'
import { useI18n } from '@/utils/i18n'

// 发给 AI 的真实指令（固定日语，不随 UI 语言变化）
// 这样无论用户 UI 设为中文/英文，AI 收到的始终是一致的日语指令
const PROMPT_TEMPLATES: Record<string, string> = {
  reply: 'このお問い合わせに対して、丁寧で専門的な返信を作成してください。',
  apologize: 'お客様への丁重なお詫びの返信を作成してください。問題の解決策も提案してください。',
  confirm: '注文内容の確認と今後の対応について、お客様への返信を作成してください。',
  shipping: '配送状況に関するお客様のお問い合わせに対する返信を作成してください。',
}

export function QuickPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  const { t } = useI18n()

  // label: UI 展示文案（跟随用户语言设置）
  // key: 用于查找固定的 AI 指令模板
  const items = [
    { key: 'reply', icon: '💬', label: t('promptGenerateReply') },
    { key: 'apologize', icon: '🙇', label: t('promptApologize') },
    { key: 'confirm', icon: '📦', label: t('promptConfirmOrder') },
    { key: 'shipping', icon: '🚚', label: t('promptShippingQuery') },
  ]

  return (
    <div className="px-3 py-1">
      <Prompts
        items={items}
        onItemClick={(item) => {
          // 用 key 查模板，而非直接用 label (避免 UI 语言污染 AI 输入)
          const prompt = PROMPT_TEMPLATES[item.data.key as string]
          onSelect(prompt ?? (item.data.label as string))
        }}
        wrap
      />
    </div>
  )
}
```

- [ ] 4.3 创建 `ContextCard.tsx` 问询上下文展示卡片

```typescript
// src/components/ChatPanel/ContextCard.tsx
import { Card, Descriptions } from 'antd'
import { useI18n } from '@/utils/i18n'
import type { InquiryData } from '@/types/inquiry'

export function ContextCard({ inquiry }: { inquiry: InquiryData | null }) {
  const { t } = useI18n()
  if (!inquiry) return null

  return (
    <Card size="small" title={t('contextTitle')} className="mx-3 mt-2">
      <Descriptions size="small" column={1}>
        <Descriptions.Item label={t('contextCustomer')}>
          {inquiry.customerName}
        </Descriptions.Item>
        {inquiry.category && (
          <Descriptions.Item label={t('contextCategory')}>
            {inquiry.category}
          </Descriptions.Item>
        )}
        {inquiry.orderNumber && (
          <Descriptions.Item label={t('contextOrderNumber')}>
            {inquiry.orderNumber}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )
}
```

- [ ] 4.4 组合到 Side Panel App 中

#### 验收标准

- 消息气泡正常渲染（用户 / AI 不同样式）
- Markdown 格式正确（代码高亮、表格、列表）
- 快捷操作可点击触发
- 问询上下文卡片展示数据
- 填充和复制按钮可点击

---

### Phase 5: AI 对话集成 (useXChat)

#### 目标

接入 AI 流式 API，实现真正的对话功能。

#### 任务清单

- [ ] 5.1 创建 AI Provider 抽象层

```typescript
// src/services/ai/types.ts
export interface AIProvider {
  /** 流式生成回复 */
  generateStream(
    messages: Array<{ role: string; content: string }>,
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
      signal?: AbortSignal
    }
  ): AsyncGenerator<string>

  /** 测试连接 */
  testConnection(): Promise<boolean>
}
```

```typescript
// src/services/ai/openai-compatible.ts
export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private defaultModel: string
  ) {}

  async *generateStream(messages, options): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      }),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') return

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // 跳过解析失败的 chunk
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
```

- [ ] 5.2 创建 `useStreamChat` Hook（Side Panel 端）

```typescript
// src/hooks/useStreamChat.ts
import { useState, useRef, useCallback } from 'react'
import type { Message } from '@/types/message'

export function useStreamChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  // 保持最新 messages，避免 sendMessage 闭包拿到旧值导致上下文缺失
  const messagesRef = useRef<Message[]>([])
  const setMessagesSafe = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }, [])

  const portRef = useRef<chrome.runtime.Port | null>(null)

  const sendMessage = useCallback((content: string, systemPrompt?: string) => {
    const now = Date.now()

    const userMsg: Message = {
      id: `user-${now}`,
      role: 'user',
      content,
      timestamp: now,
      status: 'done',
    }

    const assistantMsg: Message = {
      id: `assistant-${now}`,
      role: 'assistant',
      content: '',
      timestamp: now,
      status: 'streaming',
    }

    // UI 先入队
    setMessagesSafe((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    // 发送给模型的上下文（用 ref 取最新历史）
    const history = messagesRef.current
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const allMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...history,
      { role: 'user' as const, content },
    ]

    const port = chrome.runtime.connect({ name: 'ai_stream' })
    portRef.current = port

    port.postMessage({
      type: 'START_STREAM',
      payload: { messages: allMessages },
    })

    port.onMessage.addListener((response) => {
      switch (response.type) {
        case 'STREAM_CHUNK':
          setMessagesSafe((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + response.content }
                : m
            )
          )
          break

        case 'STREAM_DONE':
          setMessagesSafe((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, status: 'done' } : m
            )
          )
          setLoading(false)
          port.disconnect()
          break

        case 'STREAM_ERROR':
          setMessagesSafe((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, status: 'error' } : m
            )
          )
          setLoading(false)
          port.disconnect()
          break
      }
    })

    port.onDisconnect.addListener(() => {
      if (portRef.current === port) portRef.current = null
    })
  }, [setMessagesSafe])

  const abort = useCallback(() => {
    const port = portRef.current
    if (!port) return
    port.postMessage({ type: 'ABORT_STREAM' })
    port.disconnect()
    portRef.current = null
    setLoading(false)
  }, [])

  return { messages, loading, sendMessage, abort }
}

```

- [ ] 5.3 构建 System Prompt 注入问询上下文

```typescript
// src/utils/build-system-prompt.ts
import type { InquiryData } from '@/types/inquiry'

export function buildSystemPrompt(inquiry: InquiryData | null, customPrompt?: string): string {
  const base = customPrompt || `あなたは日本の EC サイトのカスタマーサポート担当者です。
丁寧で専門的な日本語で、お客様のお問い合わせに回答してください。`

  if (!inquiry) return base

  return `${base}

【現在のお問い合わせ情報】
- お問い合わせ番号: ${inquiry.inquiryId}
- お客様名: ${inquiry.customerName}
${inquiry.category ? `- カテゴリー: ${inquiry.category}` : ''}
${inquiry.orderNumber ? `- 注文番号: ${inquiry.orderNumber}` : ''}
${inquiry.receivedTime ? `- 受付日時: ${inquiry.receivedTime}` : ''}

【お問い合わせ内容】
${inquiry.inquiryContent}

上記の情報に基づいて、適切な返信を作成してください。`
}
```

- [ ] 5.4 集成到 ChatPanel，实现端到端对话
- [ ] 5.5 实现中断、重试逻辑

#### 验收标准

- 发送消息能收到 AI 流式回复
- 回复以打字机效果逐字显示
- 可中断正在生成的回复
- 网络错误有提示，可重试
- AI 能感知问询上下文

---

### Phase 6: Rakuten Extractor

#### 目标

实现 Rakuten R-Messe 页面的问询数据提取和回复填充。

#### 任务清单

- [ ] 6.1 实现 Extractor 接口和工厂

```typescript
// src/extractors/factory.ts
import type { PlatformExtractor } from './types'
import { RakutenExtractor } from './rakuten'
// import { MercariExtractor } from './mercari'
// import { AmazonExtractor } from './amazon'

const extractors: PlatformExtractor[] = [
  new RakutenExtractor(),
  // new MercariExtractor(),
  // new AmazonExtractor(),
]

export class ExtractorFactory {
  static create(url: string): PlatformExtractor | null {
    return extractors.find((e) => e.match(url)) ?? null
  }
}
```

- [ ] 6.2 实现 Rakuten R-Messe 提取器

```typescript
// src/extractors/rakuten.ts
import type { PlatformExtractor, InquiryData } from './types'

// R-Messe 页面 DOM 选择器 (需要根据实际页面调整)
const SELECTORS = {
  inquiryId: '.inquiry-number, [data-inquiry-id]',
  customerName: '.customer-name, .inquiry-customer',
  category: '.inquiry-category, .category-label',
  content: '.inquiry-content, .message-body',
  orderNumber: '.order-number, [data-order-number]',
  receivedTime: '.received-time, .inquiry-date',
  replyTextarea: 'textarea.reply-input, textarea[name="reply"]',
} as const

export class RakutenExtractor implements PlatformExtractor {
  platform = 'rakuten' as const

  match(url: string): boolean {
    return url.includes('rmesse.rms.rakuten.co.jp')
  }

  async extract(): Promise<InquiryData | null> {
    try {
      const inquiryId = this.getText(SELECTORS.inquiryId)
      if (!inquiryId) return null

      return {
        platform: 'rakuten',
        inquiryId,
        customerName: this.getText(SELECTORS.customerName) || '不明',
        category: this.getText(SELECTORS.category),
        inquiryContent: this.getText(SELECTORS.content) || '',
        orderNumber: this.getText(SELECTORS.orderNumber),
        receivedTime: this.getText(SELECTORS.receivedTime),
      }
    } catch {
      return null
    }
  }

  async fillReply(content: string): Promise<boolean> {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      SELECTORS.replyTextarea
    )
    if (!textarea) return false

    // 兼容 React 受控组件
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    )?.set
    nativeInputValueSetter?.call(textarea, content)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    textarea.focus()

    return true
  }

  getInquiryId(): string | null {
    return this.getText(SELECTORS.inquiryId)
  }

  private getText(selector: string): string | null {
    const selectors = selector.split(',').map((s) => s.trim())
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el?.textContent?.trim()) return el.textContent.trim()
    }
    return null
  }
}
```

- [ ] 6.3 在 Content Script 中集成（已在 WXT 配置章节定义）
- [ ] 6.4 实现填充回复功能端到端联调
- [ ] 6.5 实际在 R-Messe 页面测试，根据真实 DOM 调整选择器

#### 验收标准

- 打开 R-Messe 问询页面自动提取数据
- Side Panel 显示问询上下文
- AI 回复能正确填充到回复框
- SPA 路由切换时自动更新

---

### Phase 7: 对话管理 (Zustand 持久化)

#### 目标

实现按问询隔离的多对话管理，支持持久化和切换。

#### 任务清单

- [ ] 7.1 实现 Conversation Store

```typescript
// src/stores/conversation.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Conversation, Message, Platform } from '@/types'

const MAX_MESSAGES_PER_CONV = 50
// chrome.storage.local 配额 10MB，预留 1MB 给其他数据 (settings 等)
const STORAGE_BUDGET_BYTES = 9 * 1024 * 1024 // 9MB

// 估算对象序列化后的字节数
function estimateBytes(obj: unknown): number {
  return new Blob([JSON.stringify(obj)]).size
}

interface ConversationStore {
  conversations: Record<string, Conversation>
  activeConversationId: string | null

  setActiveConversation: (id: string | null) => void
  getOrCreateConversation: (data: {
    platform: Platform
    inquiryId: string
    customerName: string
    inquiryContent: string
    systemPrompt: string
  }) => string  // 返回 conversation id

  addMessage: (convId: string, msg: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastAssistantMessage: (convId: string, content: string) => void
  finalizeLastAssistantMessage: (convId: string) => void

  clearConversation: (convId: string) => void
  deleteConversation: (convId: string) => void
  clearAllConversations: () => void  // 用户一键清理
  pruneByStorageBudget: () => void   // 按字节预算裁剪
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: {},
      activeConversationId: null,

      setActiveConversation: (id) => set({ activeConversationId: id }),

      getOrCreateConversation: (data) => {
        const id = `${data.platform}:${data.inquiryId}`
        const existing = get().conversations[id]
        if (existing) {
          // 更新问询内容 (可能有新消息)
          set((state) => ({
            conversations: {
              ...state.conversations,
              [id]: { ...existing, inquiryContent: data.inquiryContent, updatedAt: Date.now() },
            },
            activeConversationId: id,
          }))
          return id
        }

        // 新建对话
        const conv: Conversation = {
          id,
          platform: data.platform,
          inquiryId: data.inquiryId,
          customerName: data.customerName,
          inquiryContent: data.inquiryContent,
          systemPrompt: data.systemPrompt,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        set((state) => ({
          conversations: { ...state.conversations, [id]: conv },
          activeConversationId: id,
        }))

        // 检查存储预算
        get().pruneByStorageBudget()
        return id
      },

      addMessage: (convId, msg) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state

          let messages = [...conv.messages, {
            ...msg,
            id: `${msg.role}-${Date.now()}`,
            timestamp: Date.now(),
          }]

          // 超过每对话消息上限时裁剪最旧的
          if (messages.length > MAX_MESSAGES_PER_CONV) {
            messages = messages.slice(-MAX_MESSAGES_PER_CONV)
          }

          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages, updatedAt: Date.now() },
            },
          }
        })
      },

      updateLastAssistantMessage: (convId, content) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state
          const messages = [...conv.messages]
          const last = messages[messages.length - 1]
          if (last?.role === 'assistant') {
            messages[messages.length - 1] = { ...last, content }
          }
          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages },
            },
          }
        })
      },

      finalizeLastAssistantMessage: (convId) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state
          const messages = [...conv.messages]
          const last = messages[messages.length - 1]
          if (last?.role === 'assistant') {
            messages[messages.length - 1] = { ...last, status: 'done' }
          }
          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages, updatedAt: Date.now() },
            },
          }
        })
      },

      clearConversation: (convId) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state
          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages: [], updatedAt: Date.now() },
            },
          }
        })
      },

      deleteConversation: (convId) => {
        set((state) => {
          const { [convId]: _, ...rest } = state.conversations
          return {
            conversations: rest,
            activeConversationId:
              state.activeConversationId === convId ? null : state.activeConversationId,
          }
        })
      },

      clearAllConversations: () => {
        set({ conversations: {}, activeConversationId: null })
      },

      pruneByStorageBudget: () => {
        set((state) => {
          const totalBytes = estimateBytes(state.conversations)
          if (totalBytes <= STORAGE_BUDGET_BYTES) return state

          // 对单个超大对话做兜底裁剪：先丢最早的 messages，再截断 inquiryContent
          const trimConversationToFit = (conv: Conversation, maxBytes: number): Conversation => {
            let next = { ...conv, messages: [...conv.messages] }
            while (estimateBytes(next) > maxBytes && next.messages.length > 0) {
              next.messages.shift()
            }
            if (estimateBytes(next) > maxBytes && next.inquiryContent?.length) {
              next.inquiryContent = next.inquiryContent.slice(0, 2000) + '…'
            }
            return next
          }

          // 按更新时间排序：优先保留最新对话
          const sorted = Object.entries(state.conversations)
            .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)

          const kept: Record<string, Conversation> = {}
          let accBytes = 0

          for (const [id, conv] of sorted) {
            const convBytes = estimateBytes(conv)
            if (accBytes + convBytes > STORAGE_BUDGET_BYTES) continue
            kept[id] = conv
            accBytes += convBytes
          }

          // 极端情况：最新对话单体就超预算，至少保留它（裁剪后）
          if (Object.keys(kept).length === 0 && sorted.length > 0) {
            const [id, newest] = sorted[0]
            const trimmed = trimConversationToFit(newest, STORAGE_BUDGET_BYTES)
            kept[id] = trimmed
            accBytes = estimateBytes(trimmed)
          }

          const nextActive =
            state.activeConversationId && kept[state.activeConversationId]
              ? state.activeConversationId
              : Object.keys(kept)[0] ?? null

          console.warn(
            `[Storage] Pruned: ${sorted.length - Object.keys(kept).length} conversations removed, ` +
            `${(totalBytes / 1024).toFixed(0)}KB → ${(accBytes / 1024).toFixed(0)}KB`
          )

          return { conversations: kept, activeConversationId: nextActive }
        })
      },
    }),
    {
      name: 'inquiry-ai-conversations',
      // 持久化时过滤掉 streaming 中间态消息，只落盘 done/error 状态的消息
      partialize: (state) => ({
        conversations: Object.fromEntries(
          Object.entries(state.conversations).map(([id, conv]) => [
            id,
            {
              ...conv,
              messages: conv.messages
                .filter((m) => m.status !== 'streaming' && m.status !== 'pending')
                .map(({ status, ...rest }) => ({ ...rest, status: status ?? 'done' })),
            },
          ])
        ),
        activeConversationId: state.activeConversationId,
      }),
      storage: {
        getItem: async (name) => {
          const result = await chrome.storage.local.get(name)
          return result[name] ?? null
        },
        setItem: async (name, value) => {
          await chrome.storage.local.set({ [name]: value })
        },
        removeItem: async (name) => {
          await chrome.storage.local.remove(name)
        },
      },
    }
  )
)
```

- [ ] 7.2 创建 `ConversationList` 组件

```typescript
// src/components/ConversationList/index.tsx
import { Conversations } from '@ant-design/x'
import { useConversationStore } from '@/stores/conversation'

export function ConversationList() {
  const conversations = useConversationStore((s) => s.conversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const setActive = useConversationStore((s) => s.setActiveConversation)
  const deleteConv = useConversationStore((s) => s.deleteConversation)

  const items = Object.values(conversations)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((conv) => ({
      key: conv.id,
      label: conv.customerName,
      description: conv.inquiryContent.slice(0, 30) + '...',
      timestamp: conv.updatedAt,
    }))

  return (
    <Conversations
      items={items}
      activeKey={activeId ?? undefined}
      onActiveChange={setActive}
      menu={(conv) => ({
        items: [
          { key: 'delete', label: '削除', danger: true },
        ],
        onClick: ({ key }) => {
          if (key === 'delete') deleteConv(conv.key)
        },
      })}
    />
  )
}
```

- [ ] 7.2 实现 Side Panel ↔ Background 上下文桥接（监听 INQUIRY_UPDATED / TAB_CHANGED / TAB_CLOSED）

```typescript
// src/hooks/useInquiryContextBridge.ts
import { useEffect } from 'react'
import type { RuntimeMessage } from '@/types/messages'
import { useConversationStore } from '@/stores/conversation'

export function useInquiryContextBridge() {
  const getOrCreateConversation = useConversationStore((s) => s.getOrCreateConversation)
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)

  useEffect(() => {
    const handler = (msg: RuntimeMessage) => {
      switch (msg.type) {
        case 'INQUIRY_UPDATED': {
          const { tabId: _tabId, ...inquiry } = msg.payload
          const convId = getOrCreateConversation({
            platform: inquiry.platform,
            inquiryId: inquiry.inquiryId,
            customerName: inquiry.customerName,
            inquiryContent: inquiry.inquiryContent,
            systemPrompt: inquiry.systemPrompt,
          })
          setActiveConversation(convId)
          break
        }

        case 'TAB_CHANGED': {
          // 当前 Tab/页面变化但还没拿到新问询数据：先清空上下文，等待下一条 INQUIRY_UPDATED
          setActiveConversation(null)
          break
        }

        case 'TAB_CLOSED': {
          // 如果关闭的是当前关联 tab，可清空上下文；对话历史是否删除由产品策略决定
          setActiveConversation(null)
          break
        }
      }
    }

    chrome.runtime.onMessage.addListener(handler as any)
    return () => chrome.runtime.onMessage.removeListener(handler as any)
  }, [getOrCreateConversation, setActiveConversation])
}
```

> 在 `App.tsx` 或 `ChatPanel` 顶层调用一次 `useInquiryContextBridge()` 即可。

- [ ] 7.3 实现问询切换自动关联对话
- [ ] 7.4 实现刷新后恢复对话
- [ ] 7.5 集成到 Side Panel 布局

#### 验收标准

- 不同问询自动创建独立对话
- 切换问询页面时 Side Panel 自动切换对话
- 刷新页面对话不丢失
- 对话列表可删除
- 超过 100 个对话自动清理最旧的

---

### Phase 8: 多语言实现方案

#### 技术选型

采用 **混合方案**：应用内语言切换（方案 A）+ manifest 本地化（browser.i18n）。

| 层面 | 方案 | 说明 |
|------|------|------|
| **应用内 UI** | Zustand + 内嵌翻译 (方案 A) | 支持应用内实时切换语言，无需修改浏览器设置 |
| **Manifest 本地化** | browser.i18n `__MSG_key__` | 扩展名称/描述 跟随浏览器语言 |

> **为什么不用纯 browser.i18n？** Chrome Extension 的 `browser.i18n` 语言跟随浏览器设置，无法在扩展内切换。
> 我们的目标用户（中国运营人员）浏览器可能设置为日语，但希望 UI 显示中文。所以 UI 部分使用方案 A。

#### 架构分层

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. Manifest 本地化 (browser.i18n)                                      │
│  - public/_locales/{ja,zh_CN,en}/messages.json                         │
│  - 仅用于扩展 name/description，跟随浏览器语言                          │
├────────────────────────────────────────────────────────────────────────┤
│  2. 应用 UI 本地化 (Zustand + 内嵌翻译)                                 │
│  - src/locales/{zh,ja,en}.ts                                           │
│  - 用户可在设置中切换，存储到 chrome.storage.local                      │
│  - 即时生效，无需刷新                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Manifest 本地化 (仅扩展名称/描述)

```
public/
└── _locales/
    ├── zh_CN/messages.json    # { "extName": { "message": "AI 客服助手" } }
    ├── ja/messages.json       # { "extName": { "message": "AI カスタマーサポート" } }
    └── en/messages.json       # { "extName": { "message": "AI Customer Support" } }
```

> Manifest 中使用 `__MSG_extName__` 引用，仅包含 `extName` 和 `extDescription` 两个 key。

#### 应用内翻译数据

```typescript
// src/locales/zh.ts
export const zh = {
  // 通用
  settings: '设置',
  save: '保存',
  cancel: '取消',
  confirm: '确认',
  delete: '删除',
  copy: '复制',
  copied: '已复制',
  fill: '填充',
  filled: '已填充',
  loading: '加载中...',
  error: '错误',
  retry: '重试',

  // 欢迎
  welcomeTitle: 'AI 客服助手',
  welcomeDescription: '我可以帮您快速生成专业的客服回复',

  // 快捷操作
  promptGenerateReply: '生成回复',
  promptApologize: '礼貌道歉',
  promptConfirmOrder: '确认订单',
  promptShippingQuery: '物流查询',

  // 问询上下文
  contextTitle: '问询上下文',
  contextCustomer: '客户',
  contextCategory: '类别',
  contextOrderNumber: '订单号',

  // 输入
  inputPlaceholder: '输入消息，按 Enter 发送...',
  inputInitializing: '正在初始化...',

  // 对话
  messagesCount: '{0} 条消息',
  messagesClearConfirm: '确定清空对话？',

  // 设置页
  interfaceSettings: '界面设置',
  aiSettings: 'AI 设置',
  dialogSettings: '对话设置',
  language: '语言',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  provider: '服务商',
  customProvider: '自定义',
  apiUrl: 'API 地址',
  apiKey: 'API 密钥',
  model: '模型',
  testConnection: '测试连接',
  connectionSuccess: '连接成功',
  connectionFailed: '连接失败',
  connectionError: '连接错误',
  maxTokens: '最大 Token',
  streamOutput: '流式输出',
  systemPromptLabel: '系统提示词',
  resetDefaults: '恢复默认',
} as const

export type TranslationKey = keyof typeof zh
```

```typescript
// src/locales/ja.ts
import type { TranslationKey } from './zh'

export const ja: Record<TranslationKey, string> = {
  settings: '設定',
  save: '保存',
  cancel: 'キャンセル',
  confirm: '確認',
  delete: '削除',
  copy: 'コピー',
  copied: 'コピーしました',
  fill: '入力',
  filled: '入力しました',
  loading: '読み込み中...',
  error: 'エラー',
  retry: '再試行',
  welcomeTitle: 'AI カスタマーサポート',
  welcomeDescription: 'プロフェッショナルな返信を素早く生成します',
  promptGenerateReply: '返信を生成',
  promptApologize: 'お詫び',
  promptConfirmOrder: '注文確認',
  promptShippingQuery: '配送確認',
  contextTitle: 'お問い合わせ情報',
  contextCustomer: 'お客様',
  contextCategory: 'カテゴリー',
  contextOrderNumber: '注文番号',
  inputPlaceholder: 'メッセージを入力して Enter で送信...',
  inputInitializing: '初期化中...',
  messagesCount: '{0} 件のメッセージ',
  messagesClearConfirm: '会話をクリアしますか？',
  interfaceSettings: 'インターフェース設定',
  aiSettings: 'AI 設定',
  dialogSettings: '会話設定',
  language: '言語',
  theme: 'テーマ',
  themeSystem: 'システムに従う',
  themeLight: 'ライト',
  themeDark: 'ダーク',
  provider: 'サービス',
  customProvider: 'カスタム',
  apiUrl: 'API URL',
  apiKey: 'API キー',
  model: 'モデル',
  testConnection: '接続テスト',
  connectionSuccess: '接続成功',
  connectionFailed: '接続失敗',
  connectionError: '接続エラー',
  maxTokens: '最大トークン',
  streamOutput: 'ストリーミング出力',
  systemPromptLabel: 'システムプロンプト',
  resetDefaults: 'デフォルトに戻す',
}
```

```typescript
// src/locales/en.ts
import type { TranslationKey } from './zh'

export const en: Record<TranslationKey, string> = {
  settings: 'Settings',
  save: 'Save',
  cancel: 'Cancel',
  confirm: 'Confirm',
  delete: 'Delete',
  copy: 'Copy',
  copied: 'Copied',
  fill: 'Fill',
  filled: 'Filled',
  loading: 'Loading...',
  error: 'Error',
  retry: 'Retry',
  welcomeTitle: 'AI Customer Support',
  welcomeDescription: 'I can help you generate professional replies quickly',
  promptGenerateReply: 'Generate Reply',
  promptApologize: 'Apologize',
  promptConfirmOrder: 'Confirm Order',
  promptShippingQuery: 'Shipping Query',
  contextTitle: 'Inquiry Context',
  contextCustomer: 'Customer',
  contextCategory: 'Category',
  contextOrderNumber: 'Order Number',
  inputPlaceholder: 'Type a message, press Enter to send...',
  inputInitializing: 'Initializing...',
  messagesCount: '{0} messages',
  messagesClearConfirm: 'Clear conversation?',
  interfaceSettings: 'Interface',
  aiSettings: 'AI Settings',
  dialogSettings: 'Conversation',
  language: 'Language',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  provider: 'Provider',
  customProvider: 'Custom',
  apiUrl: 'API URL',
  apiKey: 'API Key',
  model: 'Model',
  testConnection: 'Test Connection',
  connectionSuccess: 'Connected',
  connectionFailed: 'Connection failed',
  connectionError: 'Connection error',
  maxTokens: 'Max Tokens',
  streamOutput: 'Streaming',
  systemPromptLabel: 'System Prompt',
  resetDefaults: 'Reset Defaults',
}
```

#### i18n 工具函数 + React Hook

```typescript
// src/utils/i18n.ts
import { zh } from '@/locales/zh'
import { ja } from '@/locales/ja'
import { en } from '@/locales/en'
import { useSettingsStore } from '@/stores/settings'
import type { TranslationKey } from '@/locales/zh'

const localeMap = { zh, ja, en } as const

/**
 * 获取翻译文本 (非 React 环境)
 */
export function t(key: TranslationKey, ...args: string[]): string {
  const lang = useSettingsStore.getState().language
  let text = localeMap[lang]?.[key] || localeMap['ja']?.[key] || key

  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg)
  })

  return text
}

/**
 * React Hook - 响应式翻译 (语言切换时自动重渲染)
 */
export function useI18n() {
  const language = useSettingsStore((s) => s.language)

  const translate = (key: TranslationKey, ...args: string[]) => {
    let text = localeMap[language]?.[key] || localeMap['ja']?.[key] || key
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg)
    })
    return text
  }

  return { t: translate, language }
}
```

#### 支持的语言

| 语言 | 代码 | 用户设置值 | 主要用户 |
|------|------|-----------|----------|
| 中文 (简体) | `zh-CN` | `zh` | 内部运营人员 |
| 日语 | `ja` | `ja` | 日本客服、系统默认 |
| 英语 | `en` | `en` | 国际化支持 |

#### 设计要点

1. **翻译 key 类型安全** - `TranslationKey` 类型从 `zh.ts` 自动推导，新增 key 时只需改一处
2. **即时切换** - 用户在设置页切换语言，`useSettingsStore` 触发重渲染，无需刷新
3. **Fallback 策略** - 找不到翻译时 fallback 到日语 → key 本身
4. **Manifest 独立** - `public/_locales/` 仅用于 `__MSG_extName__`，与应用 UI 翻译互不干扰
5. **Ant Design 联动** - `ConfigProvider locale` 也随 `language` 切换（见 Phase 2 App.tsx 代码）

---

### Phase 9: 优化打磨

#### 目标

UI 细节优化、全局错误处理、性能优化、开发体验打磨。

#### 任务清单

- [ ] 9.1 **全局错误边界**

```typescript
// src/components/common/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message}
          extra={
            <Button onClick={() => this.setState({ hasError: false })}>
              Retry
            </Button>
          }
        />
      )
    }
    return this.props.children
  }
}
```

- [ ] 9.2 **网络请求重试机制**

```typescript
// src/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)))
    }
  }
  throw new Error('Unreachable')
}
```

- [ ] 9.3 **流式超时保护** - 30 秒无新 chunk 自动断开
- [ ] 9.4 **消息列表虚拟滚动** - 对话超长时使用 `react-window` 优化
- [ ] 9.5 **深色模式适配** - 确保所有组件在深色模式下正常
- [ ] 9.6 **键盘快捷键** - Enter 发送, Shift+Enter 换行, Escape 关闭
- [ ] 9.7 **空状态优化** - 使用 `@ant-design/x` 的 Welcome 组件
- [ ] 9.8 **Loading 骨架屏** - 消息加载时显示骨架

#### 验收标准

- 全局错误不会导致白屏
- 网络错误有友好提示
- 长对话滚动流畅
- 深色模式无 UI 异常

---

### Phase 10-11: 平台扩展 (Mercari / Amazon)

> 在 Rakuten 平台稳定后实施。只需实现对应的 `PlatformExtractor`，核心架构不变。

#### 任务模板 (每个平台)

- [ ] 分析目标页面 DOM 结构
- [ ] 实现 `match()` / `extract()` / `fillReply()` 
- [ ] 在 `wxt.config.ts` 和 Content Script matches 中添加 URL pattern
- [ ] 测试端到端流程

---

## 错误处理策略

| 场景 | 处理方式 |
|------|---------|
| Content Script 提取失败 | 静默失败，Side Panel 显示"无法获取问询数据" |
| AI API 请求失败 (4xx) | 显示错误消息 + 重试按钮 |
| AI API 请求失败 (5xx) | 自动重试 3 次，指数退避 |
| AI API Rate Limit (429) | 显示"请求过于频繁"+ 倒计时 |
| 流式响应超时 (30s 无 chunk) | 自动断开，显示已接收的部分内容 |
| Service Worker 被回收 | Port 断开时前端显示重连提示 |
| chrome.storage 配额接近上限 (9MB 预算) | 按字节预算自动裁剪最旧对话，提供一键清理入口 |
| 填充回复失败 | 提示"填充失败"+ 复制到剪贴板作为 fallback |
| Side Panel 与 Background 通信失败 | 重连机制 + 友好提示 |

---

## 安全考虑

1. **API Key 存储**: 使用 `chrome.storage.local` 存储（仅本地可访问，不会同步到 Google 账号）。
   加密方案暂不实施（扩展内存中必须解密才能使用，加密更多是心理安慰）。
   但需在设置页提醒用户 API Key 仅在本地存储。

2. **权限最小化**:
   - `permissions`: `storage`（本地设置/对话）、`tabs`（仅用于获取当前 tabId + 监听激活切换，不读取历史）、`permissions`（运行时申请 optional host 权限）
   - 电商平台域名放 `host_permissions`（Content Script 仅在这些域名注入）
   - AI API 域名放 `optional_host_permissions`，在 **首次请求/测试连接** 时用 `chrome.permissions.request` 只申请当前配置的 **origin**（例如 `https://api.openai.com/*`）
   - Chrome Web Store 版本不启用 `https://*/*` 这种泛域名 optional host；如需自建 Endpoint，建议提供企业/私有分发构建（在该构建中再启用泛域名 optional host）
   - 不申请 `<all_urls>`


3. **CSP 兼容**: Side Panel 是独立 HTML，不受页面 CSP 限制。Content Script 的 fetch 由 Background 中转。

4. **数据隔离**: 每个平台的 Extractor 只在对应域名下运行（由 `matches` 限制）。

---

## 开发环境配置

### 快速开始

```bash
# 创建项目
pnpm create wxt@latest inquiry-ai-assistant --template react

# 安装依赖
cd inquiry-ai-assistant && pnpm install

# 开发模式 (自动打开 Chrome 并加载扩展)
pnpm dev

# 构建
pnpm build

# 打包 zip
pnpm zip
```

### 环境变量

```bash
# .env.example
# 仅开发用，生产环境通过设置页面配置
VITE_DEFAULT_API_URL=https://api.openai.com/v1
VITE_DEFAULT_MODEL=gpt-4o-mini
```

### 推荐 VSCode 插件

- ESLint + Prettier
- Tailwind CSS IntelliSense
- Chrome Extension 调试工具

### 调试技巧

| 场景 | 方法 |
|------|------|
| Side Panel 调试 | 右键 Side Panel → 检查 |
| Background 调试 | chrome://extensions → Service Worker → 检查 |
| Content Script 调试 | 页面 DevTools → Console (选择扩展 context) |
| Storage 查看 | chrome://extensions → 详情 → 检查视图 → Application → Storage |

---

## Post-MVP 规划

以下功能不在 Phase 1-11 范围内，待 MVP 稳定后按优先级迭代。

### 会话管理与存储治理

当前实现将所有对话消息存储在 `chrome.storage.local` 的单个 key 下（默认限额 10MB），短期可用但长期需要治理：

- **多会话管理**：引入 `@ant-design/x-sdk` 的 `useXConversations`，按页面 / 日期自动分组独立会话
- **会话标题自动生成**：取首条用户消息摘要作为会话标题
- **会话列表 UI**：左侧会话列表 + 右侧对话内容，支持切换、删除、搜索
- **单会话消息上限**：超过 N 条（如 200）自动截断最早的消息，避免单会话过大
- **过期清理策略**：按天/按周自动归档或删除超过 30 天的会话
- **存储空间监控**：接近 `chrome.storage.local` 配额时提醒用户清理
- **会话导出**：支持导出为 JSON / Markdown 格式备份

### 其他 Post-MVP 功能

- **Gemini / 其他模型 Provider**：扩展 `ChatProvider` 支持非 OpenAI 兼容的 API 格式
- **多语言系统提示词模板库**：预设不同场景的专业提示词模板（退货、道歉、催发货等）
- **快捷键支持**：全局快捷键快速打开/关闭 Side Panel、发送消息
- **消息搜索**：在历史对话中搜索关键词
- **Token 用量统计**：追踪 API 调用次数和 token 消耗，辅助成本管理
- **离线缓存**：常用回复模板本地缓存，无网络时可用

---

## 参考资源

- [WXT 官网](https://wxt.dev/)
- [WXT GitHub](https://github.com/wxt-dev/wxt)
- [Ant Design X 官网](https://x.ant.design/)
- [Ant Design X Copilot Demo](https://x.ant.design/docs/playground/copilot-cn)
- [Ant Design X Markdown](https://x.ant.design/x-markdowns/introduce-cn)
- [Ant Design 主库](https://ant-design.antgroup.com/)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
