import { useEffect } from 'react'
import { Button, Tooltip } from 'antd'
import { SettingOutlined, ArrowLeftOutlined, FullscreenOutlined } from '@ant-design/icons'
import { useSettingsStore, useHasHydrated } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/utils/i18n'
import { ThemeProvider, useResolvedTheme } from '@/components/common/ThemeProvider'
import { SettingsPanel } from '@/components/Settings'

function SidePanelContent() {
  const hasHydrated = useHasHydrated()
  const { t } = useI18n()
  const resolvedTheme = useResolvedTheme()

  const currentView = useUIStore((s) => s.currentView)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const setView = useUIStore((s) => s.setView)

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

  const isDark = resolvedTheme === 'dark'

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="h-screen flex flex-col">
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
        <div className="flex items-center gap-1">
          {currentView === 'settings' && (
            <Tooltip title="在新标签页中打开设置">
              <Button
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
                onClick={openOptionsPage}
              />
            </Tooltip>
          )}
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
        </div>
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
  )
}

export function App() {
  return (
    <ThemeProvider>
      <SidePanelContent />
    </ThemeProvider>
  )
}
