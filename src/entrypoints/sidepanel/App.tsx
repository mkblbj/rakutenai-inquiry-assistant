import { ConfigProvider, theme, Spin } from 'antd'
import { XProvider } from '@ant-design/x'

export function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#2478AE' },
      }}
    >
      <XProvider>
        <div className="h-screen flex flex-col">
          <header className="p-3 border-b font-bold text-lg">
            AI 客服助手
          </header>
          <main className="flex-1 flex items-center justify-center text-gray-500">
            Side Panel Ready ✓
          </main>
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
