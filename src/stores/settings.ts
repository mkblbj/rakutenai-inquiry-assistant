import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'

export type Language = 'zh' | 'ja' | 'en'
export type Theme = 'light' | 'dark' | 'system'
export type Provider = 'openai' | 'gemini' | 'custom'

export interface SettingsState {
  // 界面设置
  language: Language
  theme: Theme

  // AI 服务配置
  provider: Provider
  apiUrl: string
  apiKey: string
  model: string

  // 对话设置
  temperature: number
  maxTokens: number
  streamEnabled: boolean

  // 提示词模板
  systemPrompt: string

  // Actions
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setProvider: (provider: Provider) => void
  setApiConfig: (config: { apiUrl?: string; apiKey?: string; model?: string }) => void
  setDialogSettings: (settings: { temperature?: number; maxTokens?: number; streamEnabled?: boolean }) => void
  setSystemPrompt: (prompt: string) => void
  resetToDefaults: () => void
}

const defaultSettings = {
  language: 'ja' as Language,
  theme: 'system' as Theme,
  provider: 'openai' as Provider,
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  streamEnabled: true,
  systemPrompt: '',
}

// chrome.storage 适配器 (异步)
const chromeStorageAdapter: PersistStorage<SettingsState> = {
  getItem: async (name: string) => {
    const result = await chrome.storage.local.get(name)
    const value = result[name]
    if (value == null) return null
    return (typeof value === 'string' ? JSON.parse(value) : value) as StorageValue<SettingsState>
  },
  setItem: async (name: string, value: StorageValue<SettingsState>) => {
    await chrome.storage.local.set({ [name]: JSON.stringify(value) })
  },
  removeItem: async (name: string) => {
    await chrome.storage.local.remove(name)
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setProvider: (provider) => set({ provider }),
      setApiConfig: (config) => set((state) => ({ ...state, ...config })),
      setDialogSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'inquiry-ai-settings',
      storage: chromeStorageAdapter,
      // 异步 hydration 完成回调
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hasHydrated: true } as any)
      },
    },
  ),
)

// 等待 hydration 完成的 hook
export const useHasHydrated = () =>
  useSettingsStore((s) => (s as any)._hasHydrated ?? false)
