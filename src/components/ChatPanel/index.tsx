import { Avatar, Button, message } from 'antd'
import { Bubble, Sender } from '@ant-design/x'
import { RobotOutlined, UserOutlined, CopyOutlined, FormOutlined } from '@ant-design/icons'
import { XMarkdown } from '@ant-design/x-markdown'
import { useI18n } from '@/utils/i18n'
import { QuickPrompts } from './QuickPrompts'
import { ContextCard } from './ContextCard'
import type { Message } from '@/types/message'
import type { InquiryData } from '@/types/inquiry'
import type { TranslationKey } from '@/locales/zh'

interface ChatPanelProps {
  messages: Message[]
  loading: boolean
  inquiry: InquiryData | null
  onSend: (content: string) => void
  onAbort: () => void
  onFillReply: (content: string) => void
}

type BubbleStatus = 'loading' | 'success' | 'error' | 'local' | 'updating' | 'abort'

export function ChatPanel({ messages, loading, inquiry, onSend, onAbort, onFillReply }: ChatPanelProps) {
  const { t } = useI18n()

  // 把 Message[] 转为 Bubble.List 的 items
  const bubbleItems = messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      key: msg.id,
      role: msg.role as string,
      content: msg.content,
      status: mapStatus(msg.status),
      extraInfo: { originalMsg: msg },
    }))

  const assistantFooter = (_content: any, info: { extraInfo?: { originalMsg?: Message } }) => {
    const msg = info.extraInfo?.originalMsg
    if (!msg || msg.status === 'streaming') return null
    return (
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
                typing: { effect: 'typing' as const, step: 5, interval: 50 },
                contentRender: (content) => (
                  <XMarkdown>{typeof content === 'string' ? content : ''}</XMarkdown>
                ),
                footer: assistantFooter,
              },
            }}
          />
        )}
      </div>

      {/* 快捷操作：始终显示在输入框上方 */}
      <QuickPrompts onSelect={onSend} compact={messages.length > 0} />

      {/* 输入框 */}
      <div className="p-3 border-t shrink-0">
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

/** 空状态欢迎屏 */
function WelcomeScreen({ t }: { t: (key: TranslationKey, ...args: string[]) => string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-4xl">🤖</div>
      <h2 className="text-lg font-semibold">{t('welcomeTitle')}</h2>
      <p className="text-sm opacity-60">{t('welcomeDescription')}</p>
    </div>
  )
}

/** 映射内部 status 到 Bubble 的 status */
function mapStatus(status?: Message['status']): BubbleStatus | undefined {
  switch (status) {
    case 'streaming':
      return 'loading'
    case 'done':
      return 'success'
    case 'error':
      return 'error'
    case 'pending':
      return 'loading'
    default:
      return undefined
  }
}
