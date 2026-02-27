import { useEffect, useState } from 'react'
import { useConversationStore, useConversationHasHydrated } from '@/stores/conversation'
import type { InquiryData } from '@/types/inquiry'

/**
 * 监听 Background 推送的问询消息，自动管理对话切换。
 * 同时暴露当前 inquiry（用于构建 system prompt / 显示上下文卡片）。
 */
export function useInquiryContextBridge() {
  const convHydrated = useConversationHasHydrated()
  const getOrCreateConversation = useConversationStore((s) => s.getOrCreateConversation)
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)

  const [inquiry, setInquiry] = useState<InquiryData | null>(null)

  // Side Panel 打开时，主动请求当前 Tab 的问询数据
  useEffect(() => {
    if (!convHydrated) return
    ;(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        chrome.runtime.sendMessage({
          type: 'REQUEST_EXTRACT',
          payload: { tabId: tab.id },
        }).catch(() => {})
      }
    })()
  }, [convHydrated])

  // 监听 Background 推送的问询/tab 消息
  useEffect(() => {
    const handler = (msg: any) => {
      switch (msg.type) {
        case 'INQUIRY_UPDATED': {
          const { tabId: _tabId, ...inquiryData } = msg.payload
          setInquiry(inquiryData as InquiryData)
          getOrCreateConversation({
            platform: inquiryData.platform,
            inquiryId: inquiryData.inquiryId,
            customerName: inquiryData.customerName,
            inquiryContent: inquiryData.inquiryContent,
          })
          break
        }
        case 'TAB_CHANGED':
          setInquiry(null)
          setActiveConversation(null)
          break
        case 'TAB_CLOSED':
          setInquiry(null)
          setActiveConversation(null)
          break
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [getOrCreateConversation, setActiveConversation])

  return { inquiry }
}
