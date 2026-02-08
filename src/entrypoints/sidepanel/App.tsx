import { useEffect, useMemo } from 'react'
import { ConfigProvider, theme, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import jaJP from 'antd/locale/ja_JP'
import enUS from 'antd/locale/en_US'
import { XProvider } from '@ant-design/x'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useI18n } from '@/utils/i18n'

const antdLocales = { zh: zhCN, ja: jaJP, en: enUS } as const

export function App() {
  const language = useSettingsStore((s) => s.language)
  const themeMode = useSettingsStore((s) => s.theme)
  const hasHydrated = useHasHydrated()
  const { t } = useI18n()

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

  return (
    <ConfigProvider
      locale={antdLocales[language]}
      theme={{
        algorithm: resolvedTheme === 'dark'
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        token: { colorPrimary: '#2478AE' },
      }}
    >
      <XProvider>
        <div
          className="h-screen flex flex-col"
          style={{
            background: resolvedTheme === 'dark' ? '#141414' : '#ffffff',
            color: resolvedTheme === 'dark' ? '#ffffffd9' : '#000000e0',
          }}
        >
          {/* Header */}
          <header
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: resolvedTheme === 'dark' ? '#303030' : '#f0f0f0' }}
          >
            <span className="font-bold text-base">{t('welcomeTitle')}</span>
          </header>

          {/* Main Content - Phase 4 将替换为 ChatPanel */}
          <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="text-4xl">🤖</div>
            <h2 className="text-lg font-semibold">{t('welcomeTitle')}</h2>
            <p className="text-sm opacity-60">{t('welcomeDescription')}</p>
          </main>
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
