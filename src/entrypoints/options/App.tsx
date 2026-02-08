import { Typography } from 'antd'
import { ThemeProvider } from '@/components/common/ThemeProvider'
import { SettingsPanel } from '@/components/Settings'
import { useI18n } from '@/utils/i18n'

const { Title } = Typography

function OptionsContent() {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <Title level={3} className="mb-6">
        {t('welcomeTitle')} - {t('settings')}
      </Title>
      <SettingsPanel />
    </div>
  )
}

export function OptionsApp() {
  return (
    <ThemeProvider>
      <OptionsContent />
    </ThemeProvider>
  )
}
