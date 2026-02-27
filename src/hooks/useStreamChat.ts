import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { streamText } from 'ai'
import { OpenAIChatProvider, useXChat, XRequest } from '@ant-design/x-sdk'
import type { XRequestOptions } from '@ant-design/x-sdk'
import type { MessageInfo } from '@ant-design/x-sdk/es/x-chat'
import type { XModelMessage, XModelParams } from '@ant-design/x-sdk/es/chat-providers/types/model'
import { useSettingsStore } from '@/stores/settings'
import { useConversationStore } from '@/stores/conversation'
import { createGoogleProvider, type GroundingSource } from '@/providers/gemini-ai-sdk'

type MessageStatus = 'loading' | 'success' | 'error' | 'local' | 'updating' | 'abort'

/**
 * 用 groundingSupports 的 segment 信息，在文本对应位置注入 <sup>N</sup> 标记。
 * 从后往前插入，避免偏移量错位。
 */
function injectGroundingSups(text: string, supports: any[]): string {
  const insertions: Array<{ index: number; sups: string }> = []

  for (const support of supports) {
    const endIndex = support.segment?.endIndex
    if (endIndex == null) continue
    const chunkIndices: number[] = support.groundingChunkIndices || []
    if (chunkIndices.length === 0) continue
    const supTags = chunkIndices.map((i: number) => `<sup>${i + 1}</sup>`).join('')
    insertions.push({ index: endIndex, sups: supTags })
  }

  if (insertions.length === 0) return text

  const merged = new Map<number, string>()
  for (const ins of insertions) {
    merged.set(ins.index, (merged.get(ins.index) || '') + ins.sups)
  }

  let result = text
  const entries = Array.from(merged.entries()).sort((a, b) => b[0] - a[0])
  for (const [index, sups] of entries) {
    if (index <= result.length) {
      result = result.slice(0, index) + sups + result.slice(index)
    }
  }

  return result
}

const RELAXED_SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'BLOCK_NONE' as const },
  { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'BLOCK_NONE' as const },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'BLOCK_NONE' as const },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'BLOCK_NONE' as const },
]

const EMPTY_MESSAGES: never[] = []

/**
 * 统一 AI 对话 hook
 * - 消息按 activeConversationId 隔离，持久化到 ConversationStore
 * - OpenAI Compatible → useXChat + OpenAIChatProvider
 * - Gemini Native → @ai-sdk/google + streamText
 */
export function useStreamChat() {
  const settings = useSettingsStore()
  const isGemini = settings.provider === 'gemini'

  const activeConversationId = useConversationStore((s) => s.activeConversationId)

  const imageStoreRef = useRef<Map<string, string[]>>(new Map())
  const groundingStoreRef = useRef<Map<string, GroundingSource[]>>(new Map())

  // ================================================================
  // OpenAI path (useXChat — always called, hooks can't be conditional)
  // ================================================================
  const openaiProvider = useMemo(() => {
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
    messages: openaiMessages,
    onRequest: openaiOnRequest,
    isRequesting: openaiLoading,
    abort: openaiAbort,
    setMessages: setOpenaiMessages,
  } = useXChat<XModelMessage>({
    provider: openaiProvider as any,
    defaultMessages: () => Promise.resolve(EMPTY_MESSAGES),
    requestPlaceholder: { role: 'assistant', content: '' },
    requestFallback: { role: 'assistant', content: '⚠️ 请求失败，请检查 API 配置后重试。' },
  })

  // ================================================================
  // Gemini path (@ai-sdk/google + streamText)
  // ================================================================
  const [geminiMessages, setGeminiMessages] = useState<MessageInfo<XModelMessage>[]>([])
  const [geminiLoading, setGeminiLoading] = useState(false)
  const geminiAbortRef = useRef<AbortController | null>(null)
  const geminiIdRef = useRef(Date.now())

  const googleProvider = useMemo(() => {
    if (!settings.geminiApiKey) return null
    return createGoogleProvider({
      apiKey: settings.geminiApiKey,
      baseUrl: settings.geminiBaseUrl || undefined,
    })
  }, [settings.geminiApiKey, settings.geminiBaseUrl])

  const geminiSend = useCallback(
    async (content: string, systemPrompt?: string, images?: string[]) => {
      if (!googleProvider) return

      const userId = ++geminiIdRef.current
      const assistantId = ++geminiIdRef.current

      const userMsg: MessageInfo<XModelMessage> = {
        id: userId,
        message: { role: 'user', content },
        status: 'local',
      }
      const assistantMsg: MessageInfo<XModelMessage> = {
        id: assistantId,
        message: { role: 'assistant', content: '' },
        status: 'loading',
      }

      setGeminiMessages((prev) => [...prev, userMsg, assistantMsg])
      setGeminiLoading(true)

      if (images?.length) {
        imageStoreRef.current.set(content.slice(0, 80), images)
      }

      const userParts: any[] = images?.length
        ? [
            { type: 'text' as const, text: content },
            ...images.map((url) => ({
              type: 'image' as const,
              image: url,
            })),
          ]
        : [{ type: 'text' as const, text: content }]

      const aiMessages = [{ role: 'user' as const, content: userParts }]

      const googleOptions: Record<string, any> = {
        safetySettings: RELAXED_SAFETY,
      }
      const tb = settings.thinkingBudget ?? -1
      if (tb === 0) {
        googleOptions.thinkingConfig = { thinkingBudget: 0 }
      } else if (tb > 0) {
        googleOptions.thinkingConfig = { thinkingBudget: tb }
      }

      const abortController = new AbortController()
      geminiAbortRef.current = abortController

      try {
        const model = googleProvider(settings.geminiModel || 'gemini-2.5-flash')

        const result = streamText({
          model,
          system: systemPrompt,
          messages: aiMessages,
          temperature: settings.temperature ?? 0.4,
          maxOutputTokens: settings.maxTokens || undefined,
          providerOptions: { google: googleOptions },
          ...(settings.webSearchEnabled
            ? { tools: { google_search: googleProvider.tools.googleSearch({}) } }
            : {}),
          abortSignal: abortController.signal,
          maxRetries: 0,
        })

        let accumulated = ''
        for await (const chunk of result.textStream) {
          accumulated += chunk
          const snap = accumulated
          setGeminiMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, message: { role: 'assistant', content: snap } }
                : m,
            ),
          )
        }

        let finalText = accumulated
        try {
          const [sources, meta] = await Promise.all([
            result.sources,
            result.providerMetadata,
          ])

          const googleMeta = (meta as any)?.google
          const supports: any[] | undefined =
            googleMeta?.groundingMetadata?.groundingSupports

          if (supports?.length) {
            finalText = injectGroundingSups(finalText, supports)
          }

          if (sources?.length) {
            const urlSources = sources.filter(
              (s): s is Extract<typeof s, { sourceType: 'url' }> =>
                s.type === 'source' && s.sourceType === 'url',
            )
            const gs: GroundingSource[] = urlSources.map((s, i) => ({
              key: `gs-${i}`,
              title: s.title || s.url,
              url: s.url,
            }))
            if (gs.length) {
              groundingStoreRef.current.set(finalText.slice(0, 80), gs)
            }
          }
        } catch {
          // sources/metadata may not be available for all models
        }

        setGeminiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, message: { role: 'assistant', content: finalText }, status: 'success' }
              : m,
          ),
        )
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setGeminiMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    message: { role: 'assistant', content: `⚠️ 请求失败: ${err.message}` },
                    status: 'error',
                  }
                : m,
            ),
          )
        }
      } finally {
        setGeminiLoading(false)
        geminiAbortRef.current = null
      }
    },
    [googleProvider, settings.geminiModel, settings.temperature, settings.maxTokens, settings.webSearchEnabled, settings.thinkingBudget],
  )

  // ================================================================
  // Conversation switch: load messages from ConversationStore
  // ================================================================
  const prevConvIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (activeConversationId === prevConvIdRef.current) return
    prevConvIdRef.current = activeConversationId

    const conv = useConversationStore.getState().conversations[activeConversationId ?? '']
    const stored = conv?.messages ?? []
    const restored = stored.map((m) => ({
      id: m.id,
      message: m.message as XModelMessage,
      status: (m.status || 'local') as MessageStatus,
    })) as MessageInfo<XModelMessage>[]

    setOpenaiMessages(restored)
    setGeminiMessages(restored)
  }, [activeConversationId, setOpenaiMessages])

  // ================================================================
  // Unified interface
  // ================================================================
  const messages = isGemini ? geminiMessages : openaiMessages
  const loading = isGemini ? geminiLoading : openaiLoading

  // Persistence: debounced save to ConversationStore
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const convId = activeConversationId
    if (!convId) return

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const toSave = messages
        .filter((m) => m.status === 'success' || m.status === 'local' || m.status === 'error')
        .map((m) => ({
          id: m.id,
          message: {
            role: m.message.role,
            content: typeof m.message.content === 'string'
              ? m.message.content
              : (m.message.content as any)?.text ?? '',
          },
          status: m.status as string,
        }))
      useConversationStore.getState().saveMessages(convId, toSave)
    }, 500)

    return () => clearTimeout(saveTimerRef.current)
  }, [messages, activeConversationId])

  const sendMessage = useCallback(
    (content: string, systemPrompt?: string, images?: string[]) => {
      if (isGemini) {
        geminiSend(content, systemPrompt, images)
        return
      }

      const hasImages = images && images.length > 0
      let userContent: any = content
      if (hasImages) {
        userContent = [
          { type: 'text', text: content },
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
        imageStoreRef.current.set(content.slice(0, 80), images)
      }

      const params: Partial<XModelParams> = {
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userContent },
        ],
      }
      openaiOnRequest(params as any)
    },
    [isGemini, geminiSend, openaiOnRequest],
  )

  const abort = useCallback(() => {
    if (isGemini) {
      geminiAbortRef.current?.abort()
    } else {
      openaiAbort()
    }
  }, [isGemini, openaiAbort])

  const clearMessages = useCallback(() => {
    if (isGemini) {
      setGeminiMessages([])
    } else {
      setOpenaiMessages([])
    }
    if (activeConversationId) {
      useConversationStore.getState().clearConversation(activeConversationId)
    }
  }, [isGemini, setOpenaiMessages, activeConversationId])

  return {
    messages,
    parsedMessages: messages,
    loading,
    sendMessage,
    abort,
    clearMessages,
    imageStore: imageStoreRef.current,
    groundingStore: groundingStoreRef.current,
  }
}
