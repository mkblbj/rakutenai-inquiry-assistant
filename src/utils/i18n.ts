import { zh } from '@/locales/zh'
import { ja } from '@/locales/ja'
import { en } from '@/locales/en'
import { useSettingsStore } from '@/stores/settings'
import type { TranslationKey } from '@/locales/zh'

const localeMap = { zh, ja, en } as const

/**
 * 获取翻译文本 (非 React 环境)
 */
export function t(key: TranslationKey, ...args: string[]): string {
  const lang = useSettingsStore.getState().language
  let text: string = localeMap[lang]?.[key] || localeMap['ja']?.[key] || key

  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg)
  })

  return text
}

/**
 * React Hook - 响应式翻译 (语言切换时自动重渲染)
 */
export function useI18n() {
  const language = useSettingsStore((s) => s.language)

  const translate = (key: TranslationKey, ...args: string[]) => {
    let text: string = localeMap[language]?.[key] || localeMap['ja']?.[key] || key
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg)
    })
    return text
  }

  return { t: translate, language }
}
