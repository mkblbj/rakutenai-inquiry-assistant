import { useState } from 'react'
import { Avatar, Button, message } from 'antd'
import { Bubble, Sender } from '@ant-design/x'
import { RobotOutlined, UserOutlined, CopyOutlined, FormOutlined } from '@ant-design/icons'
import { XMarkdown } from '@ant-design/x-markdown'
import type { MessageInfo } from '@ant-design/x-sdk/es/x-chat'
import type { XModelMessage } from '@ant-design/x-sdk/es/chat-providers/types/model'
import { useI18n } from '@/utils/i18n'
import { QuickPrompts } from './QuickPrompts'
import { ContextCard } from './ContextCard'
import type { InquiryData } from '@/types/inquiry'
import type { TranslationKey } from '@/locales/zh'

interface ChatPanelProps {
  messages: MessageInfo<XModelMessage>[]
  loading: boolean
  inquiry: InquiryData | null
  onSend: (content: string) => void
  onAbort: () => void
  onFillReply: (content: string) => void
}

export function ChatPanel({ messages, loading, inquiry, onSend, onAbort, onFillReply }: ChatPanelProps) {
  const { t } = useI18n()
  const [inputValue, setInputValue] = useState('')

  // 提交后清空输入框
  const handleSubmit = (text: string) => {
    if (!text.trim()) return
    onSend(text)
    setInputValue('')
  }

  // MessageInfo<XModelMessage> → Bubble.List items
  const bubbleItems = messages
    .filter((m) => m.message.role !== 'system')
    .map((m) => {
      const content = typeof m.message.content === 'string' ? m.message.content : ''
      const isStreaming = m.status === 'loading' || m.status === 'updating'
      const isAssistant = m.message.role === 'assistant'

      return {
        key: m.id,
        role: m.message.role as string,
        content,
        status: m.status as 'loading' | 'success' | 'error' | 'local' | 'updating' | 'abort',
        // 关键：content 为空 + loading 状态 → Bubble 显示原生三点 loading
        loading: isAssistant && isStreaming && !content,
        // 有内容在流式时启用 streaming
        streaming: isAssistant && isStreaming && !!content,
        extraInfo: { msgInfo: m },
      }
    })

  const assistantFooter = (_content: any, info: { extraInfo?: { msgInfo?: MessageInfo<XModelMessage> } }) => {
    const m = info.extraInfo?.msgInfo
    if (!m || m.status === 'loading' || m.status === 'updating') return null
    const content = typeof m.message.content === 'string' ? m.message.content : ''
    if (!content) return null
    return (
      <div className="flex gap-1 mt-1">
        <Button
          size="small"
          type="text"
          icon={<FormOutlined />}
          onClick={() => onFillReply(content)}
        >
          {t('fill')}
        </Button>
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard.writeText(content)
            message.success(t('copied'))
          }}
        >
          {t('copy')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 问询上下文 */}
      <ContextCard inquiry={inquiry} />

      {/* 消息列表 */}
      <div className="flex-1 min-h-0">
        {messages.length === 0 ? (
          <WelcomeScreen t={t} />
        ) : (
          <Bubble.List
            autoScroll
            style={{ height: '100%' }}
            items={bubbleItems}
            role={{
              user: {
                placement: 'end',
                avatar: <Avatar icon={<UserOutlined />} style={{ background: '#87d068' }} />,
                variant: 'shadow',
              },
              assistant: {
                placement: 'start',
                avatar: <Avatar icon={<RobotOutlined />} style={{ background: '#2478AE', color: '#fff' }} />,
                variant: 'outlined',
                contentRender: (content, info) => {
                  const text = typeof content === 'string' ? content : ''
                  const isStreamingNow = info.status === 'loading' || info.status === 'updating'
                  return (
                    <XMarkdown
                      streaming={isStreamingNow ? { hasNextChunk: true, enableAnimation: true } : undefined}
                    >
                      {text}
                    </XMarkdown>
                  )
                },
                footer: assistantFooter,
              },
            }}
          />
        )}
      </div>

      {/* 快捷操作 */}
      <QuickPrompts onSelect={handleSubmit} compact={messages.length > 0} />

      {/* 输入框 */}
      <div className="p-3 border-t shrink-0">
        <Sender
          value={inputValue}
          onChange={(val: string) => setInputValue(val)}
          loading={loading}
          placeholder={t('inputPlaceholder')}
          onSubmit={handleSubmit}
          onCancel={onAbort}
        />
      </div>
    </div>
  )
}

function WelcomeScreen({ t }: { t: (key: TranslationKey, ...args: string[]) => string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-4xl">🤖</div>
      <h2 className="text-lg font-semibold">{t('welcomeTitle')}</h2>
      <p className="text-sm opacity-60">{t('welcomeDescription')}</p>
    </div>
  )
}
