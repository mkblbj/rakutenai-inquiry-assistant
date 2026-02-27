import { Tag, Empty } from 'antd'
import { Conversations } from '@ant-design/x'
import type { ConversationItemType } from '@ant-design/x/es/conversations/interface'
import { useConversationStore } from '@/stores/conversation'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import dayjs from 'dayjs'

const platformColors: Record<string, string> = {
  rakuten: '#BF0000',
  mercari: '#4DC9F6',
  amazon: '#FF9900',
}

export function ConversationList() {
  const { t } = useI18n()
  const conversations = useConversationStore((s) => s.conversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const setActive = useConversationStore((s) => s.setActiveConversation)
  const deleteConv = useConversationStore((s) => s.deleteConversation)
  const clearAll = useConversationStore((s) => s.clearAllConversations)
  const setView = useUIStore((s) => s.setView)

  const sorted = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt)

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Empty description={t('convEmpty')} />
      </div>
    )
  }

  const items: ConversationItemType[] = sorted.map((conv) => ({
    key: conv.id,
    label: (
      <div className="flex items-center gap-1.5 min-w-0">
        <Tag
          color={platformColors[conv.platform]}
          style={{ fontSize: 9, lineHeight: '14px', padding: '0 3px', margin: 0, flexShrink: 0 }}
        >
          {conv.platform.slice(0, 3)}
        </Tag>
        <span className="truncate text-sm font-medium">{conv.customerName}</span>
      </div>
    ),
    icon: (
      <span className="text-[10px] opacity-50 whitespace-nowrap">
        {dayjs(conv.updatedAt).format('MM/DD HH:mm')}
      </span>
    ),
  }))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--ant-color-border)' }}>
        <span className="text-xs opacity-60">
          {t('convCount', String(sorted.length))}
        </span>
        {sorted.length > 0 && (
          <button
            className="text-xs text-red-500 hover:text-red-600 cursor-pointer bg-transparent border-none"
            onClick={clearAll}
          >
            {t('convClearAll')}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Conversations
          items={items}
          activeKey={activeId ?? undefined}
          onActiveChange={(key) => {
            setActive(key)
            setView('chat')
          }}
          menu={(conv: ConversationItemType) => ({
            items: [
              { key: 'delete', label: t('delete'), danger: true },
            ],
            onClick: ({ key }: { key: string }) => {
              if (key === 'delete') deleteConv(conv.key)
            },
          })}
        />
      </div>
    </div>
  )
}
