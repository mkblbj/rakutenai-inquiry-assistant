import { useState } from 'react'
import { Card, Descriptions, Tag, Button, Typography } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { useI18n } from '@/utils/i18n'
import type { InquiryData, FulfillmentStatus } from '@/types/inquiry'
import type { TranslationKey } from '@/locales/zh'

const { Text } = Typography

const platformColors: Record<string, string> = {
  rakuten: '#BF0000',
  mercari: '#4DC9F6',
  amazon: '#FF9900',
}

const fulfillmentTagColors: Record<FulfillmentStatus, string> = {
  not_shipped: 'orange',
  shipping: 'blue',
  delivered: 'green',
  unknown: 'default',
}

const fulfillmentI18nKeys: Record<FulfillmentStatus, TranslationKey> = {
  not_shipped: 'fulfillmentNotShipped',
  shipping: 'fulfillmentShipping',
  delivered: 'fulfillmentDelivered',
  unknown: 'fulfillmentUnknown',
}

export function ContextCard({ inquiry }: { inquiry: InquiryData | null }) {
  const { t } = useI18n()
  const [threadExpanded, setThreadExpanded] = useState(false)

  if (!inquiry) return null

  const thread = inquiry.thread ?? []
  const fulfillment = inquiry.fulfillmentStatus ?? 'unknown'

  return (
    <Card size="small" className="mx-3 mt-2 shrink-0" styles={{ body: { padding: '8px 12px' } }}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium opacity-70">{t('contextTitle')}</span>
        <Tag
          color={platformColors[inquiry.platform] || undefined}
          style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
        >
          {inquiry.platform}
        </Tag>
        <Tag
          color={fulfillmentTagColors[fulfillment]}
          style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
        >
          {t(fulfillmentI18nKeys[fulfillment])}
        </Tag>
      </div>

      {/* Basic info */}
      <Descriptions size="small" column={1} colon={false}>
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

      {/* Thread summary */}
      {thread.length > 0 && (
        <div className="mt-1">
          <Button
            type="link"
            size="small"
            onClick={() => setThreadExpanded(!threadExpanded)}
            icon={threadExpanded ? <UpOutlined /> : <DownOutlined />}
            style={{ padding: 0, fontSize: 11, height: 'auto' }}
          >
            {t('contextThread')} ({thread.length})
          </Button>

          {threadExpanded && (
            <div
              className="mt-1 max-h-40 overflow-y-auto text-xs space-y-1"
              style={{ lineHeight: 1.4 }}
            >
              {thread.map((msg, i) => (
                <div key={i} className="flex gap-1">
                  <Tag
                    color={msg.role === 'customer' ? 'red' : msg.role === 'staff' ? 'blue' : 'default'}
                    style={{ fontSize: 9, lineHeight: '14px', padding: '0 3px', margin: 0, flexShrink: 0 }}
                  >
                    {msg.role === 'customer' ? '客' : msg.role === 'staff' ? '服' : 'sys'}
                  </Tag>
                  <Text
                    className="flex-1"
                    style={{ fontSize: 11 }}
                    ellipsis={!threadExpanded || undefined}
                  >
                    {msg.time && <span className="opacity-50 mr-1">{msg.time}</span>}
                    {msg.text}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
