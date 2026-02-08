import { useEffect, useMemo } from 'react'
import { ConfigProvider, theme, Spin, Button, Tooltip } from 'antd'
import { SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import jaJP from 'antd/locale/ja_JP'
import enUS from 'antd/locale/en_US'
import { XProvider } from '@ant-design/x'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import { SettingsPanel } from '@/components/Settings'

const antdLocales = { zh: zhCN, ja: jaJP, en: enUS } as const

export function App() {
  const language = useSettingsStore((s) => s.language)
  const themeMode = useSettingsStore((s) => s.theme)
  const hasHydrated = useHasHydrated()
  const { t } = useI18n()

  const currentView = useUIStore((s) => s.currentView)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const setView = useUIStore((s) => s.setView)

  // 解析实际主题 (system → 跟随系统偏好)
  const resolvedTheme = useMemo(() => {
    if (themeMode !== 'system') return themeMode
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [themeMode])

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

  // 监听系统主题变化 (仅 system 模式)
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => useSettingsStore.setState({}) // 触发重渲染
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  // 等待 settings 从 chrome.storage 加载完成
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <ConfigProvider
      locale={antdLocales[language]}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: '#2478AE' },
      }}
    >
      <XProvider>
        <div
          className="h-screen flex flex-col"
          style={{
            background: isDark ? '#141414' : '#ffffff',
            color: isDark ? '#ffffffd9' : '#000000e0',
          }}
        >
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
          </header>

          {/* Content */}
          {currentView === 'settings' ? (
            <SettingsPanel />
          ) : (
            <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="text-4xl">🤖</div>
              <h2 className="text-lg font-semibold">{t('welcomeTitle')}</h2>
              <p className="text-sm opacity-60">{t('welcomeDescription')}</p>
            </main>
          )}
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
