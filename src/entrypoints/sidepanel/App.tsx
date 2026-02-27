import { useCallback } from 'react'
import { Button, Tooltip, message } from 'antd'
import {
  SettingOutlined,
  ArrowLeftOutlined,
  FullscreenOutlined,
  DeleteOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useConversationStore, useConversationHasHydrated } from '@/stores/conversation'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import { ThemeProvider, useResolvedTheme } from '@/components/common/ThemeProvider'
import { SettingsPanel } from '@/components/Settings'
import { ChatPanel } from '@/components/ChatPanel'
import { ConversationList } from '@/components/ConversationList'
import { useStreamChat } from '@/hooks/useStreamChat'
import { useInquiryContextBridge } from '@/hooks/useInquiryContextBridge'
import { buildSystemPrompt } from '@/utils/build-system-prompt'

function SidePanelContent() {
  const settingsHydrated = useHasHydrated()
  const convHydrated = useConversationHasHydrated()
  const { t } = useI18n()
  const resolvedTheme = useResolvedTheme()
  const settings = useSettingsStore()

  const currentView = useUIStore((s) => s.currentView)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const setView = useUIStore((s) => s.setView)

  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const conversations = useConversationStore((s) => s.conversations)
  const conversationCount = Object.keys(conversations).length

  // Bridge hook: 监听问询更新，自动管理对话切换
  const { inquiry } = useInquiryContextBridge()

  // AI 对话 (消息按对话隔离)
  const { messages, loading, sendMessage, abort, clearMessages, imageStore, groundingStore } = useStreamChat()

  // 发送消息：注入 Copilot system prompt + 可选图片
  const handleSend = useCallback((content: string, images?: string[]) => {
    if (images?.length) {
      const m = (settings.model || '').toLowerCase()
      const visionHints = ['gpt-4o', 'gpt-4-vision', 'vision', 'gemini', 'claude-3', 'claude-4', 'pixtral', 'qwen-vl', 'qwen2-vl']
      const likelySupported = visionHints.some((h) => m.includes(h))
      if (!likelySupported) {
        message.warning(t('imageNotSupported'), 4)
      }
    }
    const systemPrompt = buildSystemPrompt(inquiry, {
      shopProfile: settings.shopProfile,
      copilotPrompt: settings.copilotPrompt || undefined,
      customPrompt: settings.systemPrompt || undefined,
    })
    sendMessage(content, systemPrompt, images)
  }, [inquiry, settings.shopProfile, settings.copilotPrompt, settings.systemPrompt, settings.model, sendMessage, t])

  // 填充回复到页面
  const handleFillReply = useCallback(async (content: string) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return
      const result = await chrome.runtime.sendMessage({
        type: 'FILL_REPLY',
        payload: { tabId: tab.id, content },
      })
      if (result?.ok) {
        message.success(t('filled'))
      }
    } catch {
      // Content Script 不支持时静默
    }
  }, [t])

  const isDark = resolvedTheme === 'dark'

  // 等待 stores 完成 hydration
  if (!settingsHydrated || !convHydrated) {
    return (
      <div className="h-screen flex items-center justify-center">
        <span className="text-sm opacity-50">{t('loading')}</span>
      </div>
    )
  }

  // 当前活跃对话的客户名（用于 header 显示）
  const activeConv = activeConversationId ? conversations[activeConversationId] : null
  const headerTitle = currentView === 'settings'
    ? t('settings')
    : currentView === 'conversations'
      ? t('convList')
      : activeConv
        ? activeConv.customerName
        : t('welcomeTitle')

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: isDark ? '#303030' : '#f0f0f0' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {(currentView === 'settings' || currentView === 'conversations') && (
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView('chat')}
            />
          )}
          <span className="font-bold text-base truncate">{headerTitle}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {currentView === 'chat' && messages.length > 0 && (
            <Tooltip title={t('messagesClearConfirm')}>
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearMessages}
              />
            </Tooltip>
          )}
          {currentView === 'chat' && (
            <Tooltip title={t('convList')}>
              <Button
                type="text"
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={() => setView('conversations')}
                style={conversationCount > 0 ? undefined : { opacity: 0.4 }}
              />
            </Tooltip>
          )}
          {currentView === 'settings' && (
            <Tooltip title="在新标签页中打开设置">
              <Button
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
                onClick={() => chrome.runtime.openOptionsPage()}
              />
            </Tooltip>
          )}
          <Tooltip title={t('settings')}>
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={toggleSettings}
              style={{
                color: currentView === 'settings' ? '#2478AE' : undefined,
              }}
            />
          </Tooltip>
        </div>
      </header>

      {/* Content */}
      {currentView === 'settings' ? (
        <SettingsPanel />
      ) : currentView === 'conversations' ? (
        <ConversationList />
      ) : (
        <ChatPanel
          messages={messages}
          loading={loading}
          inquiry={inquiry}
          onSend={handleSend}
          onAbort={abort}
          onFillReply={handleFillReply}
          imageStore={imageStore}
          groundingStore={groundingStore}
        />
      )}
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <SidePanelContent />
    </ThemeProvider>
  )
}
