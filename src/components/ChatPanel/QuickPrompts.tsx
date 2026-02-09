import { Prompts } from '@ant-design/x'
import { useI18n } from '@/utils/i18n'

// 发给 AI 的真实指令（固定日语，不随 UI 语言变化）
const PROMPT_TEMPLATES: Record<string, string> = {
  reply: 'このお問い合わせに対して、丁寧で専門的な返信を作成してください。',
  apologize: 'お客様への丁重なお詫びの返信を作成してください。問題の解決策も提案してください。',
  confirm: '注文内容の確認と今後の対応について、お客様への返信を作成してください。',
  shipping: '配送状況に関するお客様のお問い合わせに対する返信を作成してください。',
}

interface QuickPromptsProps {
  onSelect: (prompt: string) => void
  /** 紧凑模式：有消息时缩小为一行 */
  compact?: boolean
}

export function QuickPrompts({ onSelect, compact }: QuickPromptsProps) {
  const { t } = useI18n()

  const items = [
    { key: 'reply', icon: '💬', label: t('promptGenerateReply') },
    { key: 'apologize', icon: '🙇', label: t('promptApologize') },
    { key: 'confirm', icon: '📦', label: t('promptConfirmOrder') },
    { key: 'shipping', icon: '🚚', label: t('promptShippingQuery') },
  ]

  return (
    <div className={compact ? 'px-3 py-0.5' : 'px-3 py-1'}>
      <Prompts
        items={items}
        onItemClick={(item) => {
          const prompt = PROMPT_TEMPLATES[item.data.key as string]
          onSelect(prompt ?? (item.data.label as string))
        }}
        wrap
        styles={compact ? { item: { padding: '4px 8px', fontSize: 12 } } : undefined}
      />
    </div>
  )
}
