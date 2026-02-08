# Inquiry AI Assistant

> 基于 Chrome Side Panel 的多平台电商客服 AI 助手

## 功能

- Chrome Side Panel 侧边栏形式
- 自动抓取电商平台问询数据
- AI 生成专业日语客服回复（流式输出）
- 一键填充回复到页面

## 支持平台

| 平台 | 状态 |
|------|------|
| Rakuten R-Messe | 首期实现 |
| Mercari | 待扩展 |
| Amazon JP | 待扩展 |

## 技术栈

- **框架**: WXT + React 19
- **UI**: Ant Design 6 + @ant-design/x
- **状态管理**: Zustand
- **样式**: Tailwind CSS v4
- **类型**: TypeScript 5

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式 (自动打开 Chrome 并加载扩展)
pnpm dev

# 构建
pnpm build

# 打包 zip
pnpm zip
```

## 项目结构

```
src/
├── entrypoints/          # WXT 入口点
│   ├── sidepanel/        # Side Panel 主界面
│   ├── background.ts     # Service Worker
│   └── content.ts        # Content Script
├── assets/               # CSS、图片等静态资源
├── components/           # UI 组件
├── extractors/           # 多平台数据提取器
├── services/             # 服务层 (AI Provider 等)
├── stores/               # Zustand 状态管理
├── hooks/                # React Hooks
├── locales/              # 应用内翻译
├── utils/                # 工具函数
└── types/                # TypeScript 类型
```

## 调试

| 场景 | 方法 |
|------|------|
| Side Panel | 右键 Side Panel → 检查 |
| Background | chrome://extensions → Service Worker → 检查 |
| Content Script | 页面 DevTools → Console (选择扩展 context) |
