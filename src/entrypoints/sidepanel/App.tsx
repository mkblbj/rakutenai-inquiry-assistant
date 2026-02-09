import { useEffect, useState, useCallback, useRef } from 'react'
import { Button, Tooltip, message } from 'antd'
import { SettingOutlined, ArrowLeftOutlined, FullscreenOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import { ThemeProvider, useResolvedTheme } from '@/components/common/ThemeProvider'
import { SettingsPanel } from '@/components/Settings'
import { ChatPanel } from '@/components/ChatPanel'
import type { Message } from '@/types/message'
import type { InquiryData } from '@/types/inquiry'

function SidePanelContent() {
  const hasHydrated = useHasHydrated()
  const { t } = useI18n()
  const resolvedTheme = useResolvedTheme()

  const currentView = useUIStore((s) => s.currentView)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const setView = useUIStore((s) => s.setView)

  // 对话状态
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [inquiry, setInquiry] = useState<InquiryData | null>(null)

  // ref 保持最新 messages
  const messagesRef = useRef<Message[]>([])
  const setMessagesSafe = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }, [])

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

  // 发送消息（Phase 4 仅做 UI 骨架，实际 AI 调用在 Phase 5）
  const handleSend = useCallback((content: string) => {
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

    setMessagesSafe((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    // 临时 mock：逐步生成内容，模拟流式效果
    const mockReply = `收到您的消息：「${content}」\n\n这是一条 **模拟回复**，用于验证 ChatPanel 的 UI 渲染。\n\n实际的 AI 对话将在 Phase 5 中接入。\n\n- Markdown 列表\n- **加粗** 和 *斜体*\n- \`代码片段\``
    let idx = 0
    const timer = setInterval(() => {
      idx += 3
      const partial = mockReply.slice(0, idx)
      setMessagesSafe((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: partial } : m
        )
      )
      if (idx >= mockReply.length) {
        clearInterval(timer)
        setMessagesSafe((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, status: 'done', content: mockReply } : m
          )
        )
        setLoading(false)
      }
    }, 30)
  }, [setMessagesSafe])

  // 中断
  const handleAbort = useCallback(() => {
    setLoading(false)
    setMessagesSafe((prev) =>
      prev.map((m) =>
        m.status === 'streaming' ? { ...m, status: 'done' } : m
      )
    )
  }, [setMessagesSafe])

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

  // 清空对话
  const handleClear = useCallback(() => {
    setMessages([])
    messagesRef.current = []
  }, [])

  const isDark = resolvedTheme === 'dark'

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage()
  }

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
                onClick={handleClear}
              />
            </Tooltip>
          )}
          {currentView === 'settings' && (
            <Tooltip title="在新标签页中打开设置">
              <Button
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
                onClick={openOptionsPage}
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
          onAbort={handleAbort}
          onFillReply={handleFillReply}
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
