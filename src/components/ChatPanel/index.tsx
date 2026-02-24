import { useState, useRef, useCallback } from 'react'
import { Avatar, Button, message, Tooltip, Image, Dropdown } from 'antd'
import { Attachments, Bubble, Sender, Sources } from '@ant-design/x'
import type { AttachmentsProps } from '@ant-design/x'
import type { UploadFile, UploadChangeParam } from 'antd/es/upload'
import {
  RobotOutlined, UserOutlined, CopyOutlined,
  StopOutlined, CheckCircleOutlined, PaperClipOutlined,
  PictureOutlined, GlobalOutlined, BulbOutlined,
} from '@ant-design/icons'
import { useSettingsStore } from '@/stores/settings'
import { XMarkdown } from '@ant-design/x-markdown'
import Latex from '@ant-design/x-markdown/plugins/Latex'
import markedAlert from 'marked-alert'
import type { ComponentProps } from '@ant-design/x-markdown'
import type { MessageInfo } from '@ant-design/x-sdk/es/x-chat'
import type { XModelMessage } from '@ant-design/x-sdk/es/chat-providers/types/model'
import { useI18n } from '@/utils/i18n'
import { checkFillGate, isCopilotFormat } from '@/utils/parse-copilot-draft'
import { fileToCompressedBase64, getImagesFromClipboard, canAddMoreImages, MAX_IMAGES } from '@/utils/image-utils'
import { QuickPrompts } from './QuickPrompts'
import { ContextCard } from './ContextCard'
import type { InquiryData } from '@/types/inquiry'
import type { GroundingSource } from '@/providers/gemini-ai-sdk'
import type { TranslationKey } from '@/locales/zh'

const alertPlugin = markedAlert()
const markdownConfig = {
  extensions: [...Latex(), ...(alertPlugin.extensions as any[] || [])],
  walkTokens: alertPlugin.walkTokens as any,
}

function createSupComponent(sources: GroundingSource[]) {
  const items = sources.map((s, i) => ({
    key: i + 1,
    title: s.title,
    url: s.url,
    description: s.url,
  }))
  return function SupRef(props: ComponentProps) {
    return (
      <Sources
        activeKey={parseInt(`${props.children}` || '0', 10)}
        title={props.children}
        items={items}
        inline
        onClick={(item) => window.open(item.url as string, '_blank')}
      />
    )
  }
}

/**
 * Gemini 的 grounded 回复通常不含 <sup> 标签，
 * 需要后处理：把 grounding sources 以 <sup> 标记注入文本末尾。
 */
function injectSourceSups(text: string, sources: GroundingSource[]): string {
  if (!sources?.length) return text
  if (/<sup>/i.test(text)) return text
  const refs = sources.map((_, i) => `<sup>${i + 1}</sup>`).join(' ')
  return `${text}\n\n${refs}`
}

function fixCjkBoldMarkers(text: string): string {
  return text
    .replace(/\*\*([「『（【〈《〔])/g, '**\u200B$1')
    .replace(/([」』）】〉》〕])\*\*/g, '$1\u200B**')
}

interface ChatPanelProps {
  messages: MessageInfo<XModelMessage>[]
  loading: boolean
  inquiry: InquiryData | null
  onSend: (content: string, images?: string[]) => void
  onAbort: () => void
  onFillReply: (content: string) => void
  imageStore: Map<string, string[]>
  groundingStore: Map<string, GroundingSource[]>
}

export function ChatPanel({ messages, loading, inquiry, onSend, onAbort, onFillReply, imageStore, groundingStore }: ChatPanelProps) {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const isGemini = settings.provider === 'gemini'

  const [inputValue, setInputValue] = useState('')
  const [headerOpen, setHeaderOpen] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachmentsProps['items']>([])
  const attachmentsRef = useRef<any>(null)
  const senderRef = useRef<any>(null)

  // Attachments → base64 转换缓存
  const base64CacheRef = useRef<Map<string, string>>(new Map())

  const processFileToBase64 = useCallback(async (file: File): Promise<string> => {
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (base64CacheRef.current.has(key)) return base64CacheRef.current.get(key)!
    const b64 = await fileToCompressedBase64(file)
    base64CacheRef.current.set(key, b64)
    return b64
  }, [])

  // 粘贴图片
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const files = getImagesFromClipboard(e.nativeEvent)
    if (files.length > 0) {
      e.preventDefault()
      const allowed = canAddMoreImages(attachedFiles?.length ?? 0, files.length)
      if (allowed <= 0) { message.warning(t('imageMaxReached')); return }
      const newItems: UploadFile[] = files.slice(0, allowed).map((f) => ({
        uid: `${Date.now()}-${Math.random()}`,
        name: f.name || 'pasted-image.png',
        status: 'done' as const,
        originFileObj: f as any,
      }))
      setAttachedFiles((prev: UploadFile[] | undefined) => [...(prev || []), ...newItems])
      setHeaderOpen(true)
    }
  }, [attachedFiles?.length, t])

  // 提交
  const handleSubmit = useCallback(async (text: string) => {
    const hasFiles = attachedFiles && attachedFiles.length > 0
    if (!text.trim() && !hasFiles) return

    const content = text.trim() || (hasFiles ? 'この画像を確認してください。' : '')

    let images: string[] | undefined
    if (hasFiles) {
      try {
        const results = await Promise.all(
          attachedFiles!.map((f: UploadFile) => {
            if (f.originFileObj) return processFileToBase64(f.originFileObj as File)
            if (f.thumbUrl) return Promise.resolve(f.thumbUrl)
            return Promise.resolve('')
          }),
        )
        images = results.filter(Boolean)
      } catch {
        message.error(t('imageLoadFailed'))
        return
      }
    }

    onSend(content, images && images.length > 0 ? images : undefined)
    setInputValue('')
    setAttachedFiles([])
    setHeaderOpen(false)
    base64CacheRef.current.clear()
  }, [onSend, attachedFiles, processFileToBase64, t])

  // 获取用户消息关联的图片
  const getUserImages = (content: string): string[] => {
    const key = content.slice(0, 80)
    return imageStore.get(key) || []
  }

  // MessageInfo → Bubble items
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
        loading: isAssistant && isStreaming && !content,
        streaming: isAssistant && isStreaming && !!content,
        extraInfo: { msgInfo: m },
      }
    })

  const assistantFooter = (_content: any, info: { extraInfo?: { msgInfo?: MessageInfo<XModelMessage> } }) => {
    const m = info.extraInfo?.msgInfo
    if (!m || m.status === 'loading' || m.status === 'updating') return null
    const content = typeof m.message.content === 'string' ? m.message.content : ''
    if (!content) return null

    const isCopilot = isCopilotFormat(content)
    const gate = isCopilot ? checkFillGate(content) : { canFill: true, fillContent: content }

    return (
      <div className="mt-1 flex gap-1">
        {gate.canFill ? (
          <Button size="small" type="text" icon={<CheckCircleOutlined />} onClick={() => onFillReply(gate.fillContent)}>
            {t('fillDraft')}
          </Button>
        ) : (
          <Tooltip title={t('fillBlocked')}>
            <Button size="small" type="text" icon={<StopOutlined />} disabled>{t('fillDraft')}</Button>
          </Tooltip>
        )}
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={() => {
            const copyText = isCopilot && gate.canFill ? gate.fillContent : content
            navigator.clipboard.writeText(copyText)
            message.success(t('copied'))
          }}
        >
          {t('copy')}
        </Button>
      </div>
    )
  }

  const attachmentsNode = (
    <Attachments
      ref={attachmentsRef}
      accept="image/*"
      maxCount={MAX_IMAGES}
      items={attachedFiles}
      onChange={(info: UploadChangeParam) => setAttachedFiles(info.fileList)}
      placeholder={{
        icon: <PictureOutlined style={{ fontSize: 20 }} />,
        title: t('imageUpload'),
        description: `${t('imageMaxReached').replace(/\d+/, String(MAX_IMAGES))} (max ${MAX_IMAGES})`,
      }}
      overflow="scrollX"
    />
  )

  return (
    <div className="flex flex-col h-full min-h-0">
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
                contentRender: (content) => {
                  const text = typeof content === 'string' ? content : ''
                  const imgs = getUserImages(text)
                  return (
                    <div>
                      {imgs.length > 0 && (
                        <div className="flex gap-1 mb-2 flex-wrap">
                          <Image.PreviewGroup>
                            {imgs.map((src, i) => (
                              <Image key={i} src={src} width={80} height={80} style={{ objectFit: 'cover', borderRadius: 6 }} />
                            ))}
                          </Image.PreviewGroup>
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
                    </div>
                  )
                },
              },
              assistant: {
                placement: 'start',
                avatar: <Avatar icon={<RobotOutlined />} style={{ background: '#2478AE', color: '#fff' }} />,
                variant: 'outlined',
                contentRender: (content, info) => {
                  const raw = typeof content === 'string' ? content : ''
                  const isStreamingNow = info.status === 'loading' || info.status === 'updating'
                  const sources = groundingStore.get(raw.slice(0, 80))
                  const text = sources?.length
                    ? injectSourceSups(fixCjkBoldMarkers(raw), sources)
                    : fixCjkBoldMarkers(raw)
                  const supComp = sources?.length ? createSupComponent(sources) : undefined
                  return (
                    <XMarkdown
                      streaming={isStreamingNow ? { hasNextChunk: true, enableAnimation: true } : undefined}
                      components={supComp ? { sup: supComp } : undefined}
                      config={markdownConfig}
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
      <div className="p-3 border-t shrink-0" onPaste={handlePaste}>
        <Sender
          ref={senderRef}
          value={inputValue}
          onChange={(val: string) => setInputValue(val)}
          loading={loading}
          placeholder={t('inputPlaceholder')}
          onSubmit={handleSubmit}
          onCancel={onAbort}
          suffix={false}
          onPasteFile={(fileList) => {
            const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
            if (imgs.length === 0) return
            const allowed = canAddMoreImages(attachedFiles?.length ?? 0, imgs.length)
            if (allowed <= 0) { message.warning(t('imageMaxReached')); return }
            const newItems: UploadFile[] = imgs.slice(0, allowed).map((f) => ({
              uid: `${Date.now()}-${Math.random()}`,
              name: f.name,
              status: 'done' as const,
              originFileObj: f as any,
            }))
            setAttachedFiles((prev: UploadFile[] | undefined) => [...(prev || []), ...newItems])
            setHeaderOpen(true)
          }}
          header={
            <Sender.Header
              title={`${t('imageUpload')} (${attachedFiles?.length ?? 0}/${MAX_IMAGES})`}
              open={headerOpen}
              onOpenChange={setHeaderOpen}
            >
              {attachmentsNode}
            </Sender.Header>
          }
          footer={(_, { components: { SendButton } }) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tooltip title={t('imageUpload')}>
                  <PaperClipOutlined
                    onClick={() => setHeaderOpen(!headerOpen)}
                    style={{ cursor: 'pointer', fontSize: 18, opacity: headerOpen ? 1 : 0.45, padding: '4px 2px' }}
                  />
                </Tooltip>
                {isGemini && (
                  <>
                    <Tooltip title={t('webSearchEnabled')}>
                      <Sender.Switch
                        icon={<GlobalOutlined />}
                        value={settings.webSearchEnabled}
                        onChange={settings.setWebSearchEnabled}
                      />
                    </Tooltip>
                  <Dropdown
                    menu={{
                      items: getThinkingMenuItems(t),
                      selectedKeys: [String(settings.thinkingBudget)],
                      onClick: ({ key }) => settings.setThinkingBudget(Number(key)),
                    }}
                    trigger={['click']}
                    placement="top"
                  >
                    <Tooltip title={t('thinkingBudget')}>
                      <BulbOutlined style={{
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: '4px 2px',
                        color: settings.thinkingBudget > 0 ? '#1677ff' : undefined,
                        opacity: settings.thinkingBudget === -1 ? 0.45 : settings.thinkingBudget === 0 ? 0.35 : 1,
                      }} />
                    </Tooltip>
                  </Dropdown>
                  </>
                )}
              </div>
              <SendButton />
            </div>
          )}
        />
      </div>
    </div>
  )
}

function getThinkingMenuItems(t: (key: TranslationKey) => string) {
  return [
    { key: '-1', label: <ThinkingMenuItem icon="💡" title={t('thinkingDefault')} desc={t('thinkingDefaultDesc')} /> },
    { key: '0', label: <ThinkingMenuItem icon="🚫" title={t('thinkingOff')} desc={t('thinkingOffDesc')} /> },
    { type: 'divider' as const },
    { key: '2048', label: <ThinkingMenuItem icon="✨" title={t('thinkingLight')} desc={t('thinkingLightDesc')} /> },
    { key: '8192', label: <ThinkingMenuItem icon="🧠" title={t('thinkingMedium')} desc={t('thinkingMediumDesc')} /> },
    { key: '24576', label: <ThinkingMenuItem icon="🔬" title={t('thinkingDeep')} desc={t('thinkingDeepDesc')} /> },
  ]
}

function ThinkingMenuItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.55 }}>{desc}</div>
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
