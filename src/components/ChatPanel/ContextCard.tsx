import { Card, Descriptions, Tag } from 'antd'
import { useI18n } from '@/utils/i18n'
import type { InquiryData } from '@/types/inquiry'

const platformColors: Record<string, string> = {
  rakuten: '#BF0000',
  mercari: '#4DC9F6',
  amazon: '#FF9900',
}

export function ContextCard({ inquiry }: { inquiry: InquiryData | null }) {
  const { t } = useI18n()
  if (!inquiry) return null

  return (
    <Card size="small" className="mx-3 mt-2 shrink-0" styles={{ body: { padding: '8px 12px' } }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium opacity-70">{t('contextTitle')}</span>
        <Tag
          color={platformColors[inquiry.platform] || undefined}
          style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
        >
          {inquiry.platform}
        </Tag>
      </div>
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
    </Card>
  )
}
