import { useEffect, useState, useCallback } from 'react'
import { Button, Tooltip, message } from 'antd'
import { SettingOutlined, ArrowLeftOutlined, FullscreenOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import { ThemeProvider, useResolvedTheme } from '@/components/common/ThemeProvider'
import { SettingsPanel } from '@/components/Settings'
import { ChatPanel } from '@/components/ChatPanel'
import { useStreamChat } from '@/hooks/useStreamChat'
import { buildSystemPrompt } from '@/utils/build-system-prompt'
import type { InquiryData } from '@/types/inquiry'

function SidePanelContent() {
  const hasHydrated = useHasHydrated()
  const { t } = useI18n()
  const resolvedTheme = useResolvedTheme()
  const settings = useSettingsStore()

  const currentView = useUIStore((s) => s.currentView)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const setView = useUIStore((s) => s.setView)

  // AI 对话 (x-sdk)
  const { messages, loading, sendMessage, abort, clearMessages, imageStore, groundingStore } = useStreamChat()

  // 问询上下文
  const [inquiry, setInquiry] = useState<InquiryData | null>(null)

  // Side Panel 打开时，主动请求当前 Tab 的问询数据
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

  // 监听 Background 推送的问询数据
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'INQUIRY_UPDATED') {
        setInquiry(msg.payload)
      } else if (msg.type === 'TAB_CHANGED' || msg.type === 'TAB_CLOSED') {
        setInquiry(null)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: isDark ? '#303030' : '#f0f0f0' }}
      >
        <div className="flex items-center gap-2">
          {currentView === 'settings' && (
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView('chat')}
            />
          )}
          <span className="font-bold text-base">
            {currentView === 'settings' ? t('settings') : t('welcomeTitle')}
          </span>
        </div>
        <div className="flex items-center gap-1">
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
