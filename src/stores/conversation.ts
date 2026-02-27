import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type { Platform } from '@/types/inquiry'

const MAX_MESSAGES_PER_CONV = 50
// chrome.storage.local 配额（unlimitedStorage 已声明），预留 1MB 给其他数据
const STORAGE_BUDGET_BYTES = 9 * 1024 * 1024

function estimateBytes(obj: unknown): number {
  return new Blob([JSON.stringify(obj)]).size
}

export interface StoredMessage {
  id: string | number
  message: { role: string; content: string }
  status: string
}

export interface Conversation {
  id: string
  platform: Platform
  inquiryId: string
  customerName: string
  inquiryContent: string
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}

interface ConversationState {
  conversations: Record<string, Conversation>
  activeConversationId: string | null

  setActiveConversation: (id: string | null) => void
  getOrCreateConversation: (data: {
    platform: Platform
    inquiryId: string
    customerName: string
    inquiryContent: string
  }) => string

  saveMessages: (convId: string, messages: StoredMessage[]) => void
  clearConversation: (convId: string) => void
  deleteConversation: (convId: string) => void
  clearAllConversations: () => void
  pruneByStorageBudget: () => void
}

const chromeStorageAdapter: PersistStorage<any> = {
  getItem: async (name) => {
    const result = await chrome.storage.local.get(name)
    const value = result[name]
    if (value == null) return null
    return (typeof value === 'string' ? JSON.parse(value) : value) as StorageValue<ConversationState>
  },
  setItem: async (name, value) => {
    await chrome.storage.local.set({ [name]: JSON.stringify(value) })
  },
  removeItem: async (name) => {
    await chrome.storage.local.remove(name)
  },
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: {},
      activeConversationId: null,

      setActiveConversation: (id) => set({ activeConversationId: id }),

      getOrCreateConversation: (data) => {
        const id = `${data.platform}:${data.inquiryId}`
        const existing = get().conversations[id]
        if (existing) {
          set((state) => ({
            conversations: {
              ...state.conversations,
              [id]: {
                ...existing,
                customerName: data.customerName,
                inquiryContent: data.inquiryContent,
                updatedAt: Date.now(),
              },
            },
            activeConversationId: id,
          }))
          return id
        }

        const conv: Conversation = {
          id,
          platform: data.platform,
          inquiryId: data.inquiryId,
          customerName: data.customerName,
          inquiryContent: data.inquiryContent,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        set((state) => ({
          conversations: { ...state.conversations, [id]: conv },
          activeConversationId: id,
        }))

        get().pruneByStorageBudget()
        return id
      },

      saveMessages: (convId, messages) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state

          let trimmed = messages
          if (trimmed.length > MAX_MESSAGES_PER_CONV) {
            trimmed = trimmed.slice(-MAX_MESSAGES_PER_CONV)
          }

          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages: trimmed, updatedAt: Date.now() },
            },
          }
        })
      },

      clearConversation: (convId) => {
        set((state) => {
          const conv = state.conversations[convId]
          if (!conv) return state
          return {
            conversations: {
              ...state.conversations,
              [convId]: { ...conv, messages: [], updatedAt: Date.now() },
            },
          }
        })
      },

      deleteConversation: (convId) => {
        set((state) => {
          const { [convId]: _, ...rest } = state.conversations
          return {
            conversations: rest,
            activeConversationId:
              state.activeConversationId === convId ? null : state.activeConversationId,
          }
        })
      },

      clearAllConversations: () => {
        set({ conversations: {}, activeConversationId: null })
      },

      pruneByStorageBudget: () => {
        set((state) => {
          const totalBytes = estimateBytes(state.conversations)
          if (totalBytes <= STORAGE_BUDGET_BYTES) return state

          const sorted = Object.entries(state.conversations)
            .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)

          const kept: Record<string, Conversation> = {}
          let accBytes = 0

          for (const [id, conv] of sorted) {
            const convBytes = estimateBytes(conv)
            if (accBytes + convBytes > STORAGE_BUDGET_BYTES) continue
            kept[id] = conv
            accBytes += convBytes
          }

          // 极端情况：最新对话单体超预算，裁剪消息后保留
          if (Object.keys(kept).length === 0 && sorted.length > 0) {
            const [id, newest] = sorted[0]
            const trimmed = { ...newest, messages: newest.messages.slice(-10) }
            if (trimmed.inquiryContent?.length > 2000) {
              trimmed.inquiryContent = trimmed.inquiryContent.slice(0, 2000) + '…'
            }
            kept[id] = trimmed
          }

          const nextActive =
            state.activeConversationId && kept[state.activeConversationId]
              ? state.activeConversationId
              : Object.keys(kept)[0] ?? null

          console.warn(
            `[Storage] Pruned: ${sorted.length - Object.keys(kept).length} conversations removed, ` +
            `${(totalBytes / 1024).toFixed(0)}KB → ${(accBytes / 1024).toFixed(0)}KB`,
          )

          return { conversations: kept, activeConversationId: nextActive }
        })
      },
    }),
    {
      name: 'inquiry-ai-conversations',
      storage: chromeStorageAdapter,
      partialize: (state) => ({
        conversations: Object.fromEntries(
          Object.entries(state.conversations).map(([id, conv]) => [
            id,
            {
              ...conv,
              messages: conv.messages.filter(
                (m) => m.status !== 'loading' && m.status !== 'updating',
              ),
            },
          ]),
        ),
        activeConversationId: state.activeConversationId,
      }),
      onRehydrateStorage: () => () => {
        useConversationStore.setState({ _hasHydrated: true } as any)
        // 清理旧版单一 key 存储
        chrome.storage.local.remove('inquiry-ai-chat-messages').catch(() => {})
      },
    },
  ),
)

export const useConversationHasHydrated = () =>
  useConversationStore((s) => (s as any)._hasHydrated ?? false)
