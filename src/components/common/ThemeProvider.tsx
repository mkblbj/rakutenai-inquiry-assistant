import { useMemo, useEffect, type ReactNode } from 'react'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import jaJP from 'antd/locale/ja_JP'
import enUS from 'antd/locale/en_US'
import { XProvider } from '@ant-design/x'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { Spin } from 'antd'

const antdLocales = { zh: zhCN, ja: jaJP, en: enUS } as const

/** 解析实际主题值 */
export function useResolvedTheme() {
  const themeMode = useSettingsStore((s) => s.theme)

  const resolved = useMemo(() => {
    if (themeMode !== 'system') return themeMode
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [themeMode])

  // 监听系统主题变化
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => useSettingsStore.setState({})
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  return resolved
}

/** 共享主题/语言 Provider，Side Panel 和 Options 页复用 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const language = useSettingsStore((s) => s.language)
  const hasHydrated = useHasHydrated()
  const resolvedTheme = useResolvedTheme()

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
          style={{
            background: isDark ? '#141414' : '#ffffff',
            color: isDark ? '#ffffffd9' : '#000000e0',
            minHeight: '100vh',
          }}
        >
          {children}
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
