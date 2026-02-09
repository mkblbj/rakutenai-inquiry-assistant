import { useMemo, useCallback, useEffect, useRef } from 'react'
import { OpenAIChatProvider, useXChat, XRequest } from '@ant-design/x-sdk'
import type { XRequestOptions } from '@ant-design/x-sdk'
import type { MessageInfo } from '@ant-design/x-sdk/es/x-chat'
import type { XModelMessage, XModelParams } from '@ant-design/x-sdk/es/chat-providers/types/model'
import { useSettingsStore } from '@/stores/settings'

const STORAGE_KEY = 'inquiry-ai-chat-messages'

type MessageStatus = 'loading' | 'success' | 'error' | 'local' | 'updating' | 'abort'

/** 从 chrome.storage 加载消息 */
async function loadMessages(): Promise<Array<{ message: XModelMessage; id?: string | number; status?: MessageStatus }>> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const raw = result[STORAGE_KEY]
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 保存消息到 chrome.storage */
function saveMessages(messages: MessageInfo<XModelMessage>[]) {
  // 只存完成的消息，排除 streaming 中的
  const toSave = messages
    .filter((m) => m.status === 'success' || m.status === 'local' || m.status === 'error')
    .map((m) => ({
      id: m.id,
      message: m.message,
      status: m.status,
    }))
  chrome.storage.local.set({ [STORAGE_KEY]: toSave }).catch(() => {})
}

/**
 * 基于 @ant-design/x-sdk 的 AI 对话 hook
 * 使用 OpenAIChatProvider + useXChat + XRequest
 */
export function useStreamChat() {
  const settings = useSettingsStore()

  // 动态创建 provider（apiUrl / apiKey / model 变更时重建）
  const provider = useMemo(() => {
    const baseUrl = (settings.apiUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')

    const request = XRequest(`${baseUrl}/chat/completions`, {
      manual: true,
      headers: {
        Authorization: `Bearer ${settings.apiKey || ''}`,
        'Content-Type': 'application/json',
      },
      params: {
        model: settings.model || 'gpt-4o-mini',
        temperature: settings.temperature ?? 0.7,
        stream: settings.streamEnabled !== false,
      } as Partial<XModelParams>,
    } as XRequestOptions<XModelParams, any>)

    return new OpenAIChatProvider({ request })
  }, [settings.apiUrl, settings.apiKey, settings.model, settings.temperature, settings.streamEnabled])

  const {
    messages,
    parsedMessages,
    onRequest,
    isRequesting,
    abort,
    setMessages,
  } = useXChat<XModelMessage>({
    provider,
    // 从 chrome.storage 恢复历史消息
    defaultMessages: loadMessages,
    requestPlaceholder: {
      role: 'assistant',
      content: '',
    },
    requestFallback: {
      role: 'assistant',
      content: '⚠️ 请求失败，请检查 API 配置后重试。',
    },
  })

  // 消息变化时持久化（防抖）
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveMessages(messages)
    }, 500)
  }, [messages])

  // 发送消息（注入 system prompt 到 messages 参数中）
  const sendMessage = useCallback((content: string, systemPrompt?: string) => {
    const params: Partial<XModelParams> = {
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content },
      ],
    }
    onRequest(params)
  }, [onRequest])

  const clearMessages = useCallback(() => {
    setMessages([])
    chrome.storage.local.remove(STORAGE_KEY).catch(() => {})
  }, [setMessages])

  return {
    messages,
    parsedMessages,
    loading: isRequesting,
    sendMessage,
    abort,
    clearMessages,
  }
}
