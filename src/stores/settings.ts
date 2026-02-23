import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'

export type Language = 'zh' | 'ja' | 'en'
export type Theme = 'light' | 'dark' | 'system'
export type Provider = 'openai' | 'gemini' | 'custom'

export interface ShopProfile {
  shopName?: string
  returnPolicy?: string
  exchangePolicy?: string
  cancelPolicy?: string
  shippingPolicy?: string
  processNotes?: string
  signature?: string
}

export interface SettingsState {
  // 界面设置
  language: Language
  theme: Theme

  // AI 服务配置
  provider: Provider
  apiUrl: string
  apiKey: string
  model: string

  // Gemini Native 独立配置
  geminiBaseUrl: string
  geminiApiKey: string
  geminiModel: string

  // 对话设置
  temperature: number
  maxTokens: number
  streamEnabled: boolean

  // Gemini Native 专用
  webSearchEnabled: boolean
  thinkingBudget: number

  // 提示词模板
  copilotPrompt: string
  systemPrompt: string

  // 店铺规则
  shopProfile: ShopProfile

  // Actions
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setProvider: (provider: Provider) => void
  setApiConfig: (config: { apiUrl?: string; apiKey?: string; model?: string }) => void
  setGeminiConfig: (config: { geminiBaseUrl?: string; geminiApiKey?: string; geminiModel?: string }) => void
  setDialogSettings: (settings: { temperature?: number; maxTokens?: number; streamEnabled?: boolean }) => void
  setWebSearchEnabled: (enabled: boolean) => void
  setThinkingBudget: (budget: number) => void
  setCopilotPrompt: (prompt: string) => void
  setSystemPrompt: (prompt: string) => void
  setShopProfile: (profile: Partial<ShopProfile>) => void
  resetToDefaults: () => void
}

const defaultSettings = {
  language: 'ja' as Language,
  theme: 'system' as Theme,
  provider: 'openai' as Provider,
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  geminiBaseUrl: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  temperature: 0.4,
  maxTokens: 4096,
  streamEnabled: true,
  webSearchEnabled: false,
  thinkingBudget: -1,
  copilotPrompt: '',
  systemPrompt: '',
  shopProfile: {} as ShopProfile,
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
      setGeminiConfig: (config) => set((state) => ({ ...state, ...config })),
      setDialogSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
      setThinkingBudget: (thinkingBudget) => set({ thinkingBudget }),
      setCopilotPrompt: (copilotPrompt) => set({ copilotPrompt }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setShopProfile: (profile) => set((state) => ({ shopProfile: { ...state.shopProfile, ...profile } })),
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
