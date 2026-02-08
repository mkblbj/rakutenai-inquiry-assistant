import type { InquiryData } from '@/types/inquiry'

export default defineBackground(() => {
  console.log('[Background] Service worker started')

  // Tab → 问询数据 映射
  const tabInquiryMap = new Map<number, InquiryData>()

  // ===== 监听 Tab 事件 =====
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId)
    const inquiry = tabInquiryMap.get(tabId)

    // 通知 Side Panel 切换上下文
    chrome.runtime.sendMessage({
      type: inquiry ? 'INQUIRY_UPDATED' : 'TAB_CHANGED',
      payload: inquiry
        ? { ...inquiry, tabId }
        : { tabId, url: tab.url ?? '' },
    }).catch(() => {}) // Side Panel 可能未打开
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabInquiryMap.delete(tabId)
    chrome.runtime.sendMessage({
      type: 'TAB_CLOSED',
      payload: { tabId },
    }).catch(() => {})
  })

  // ===== 监听 Runtime 消息 =====
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'INQUIRY_DATA': {
        const tabId = sender.tab?.id
        if (tabId) {
          tabInquiryMap.set(tabId, msg.payload)
          // 转发给 Side Panel
          chrome.runtime.sendMessage({
            type: 'INQUIRY_UPDATED',
            payload: { ...msg.payload, tabId },
          }).catch(() => {})
        }
        break
      }

      case 'PAGE_CHANGED': {
        const changedTabId = sender.tab?.id
        if (changedTabId) {
          tabInquiryMap.delete(changedTabId)
          chrome.runtime.sendMessage({
            type: 'TAB_CHANGED',
            payload: { tabId: changedTabId, url: msg.payload.url },
          }).catch(() => {})

          // 兜底：主动触发一次提取
          chrome.tabs.sendMessage(changedTabId, { type: 'REQUEST_EXTRACT' }, () => {
            void chrome.runtime.lastError
          })
        }
        break
      }

      case 'REQUEST_EXTRACT': {
        // Side Panel 请求手动提取（转发给 Content Script）
        chrome.tabs.sendMessage(
          msg.payload.tabId,
          { type: 'REQUEST_EXTRACT' },
          () => {
            const err = chrome.runtime.lastError
            if (err) sendResponse({ ok: false, error: err.message })
            else sendResponse({ ok: true })
          },
        )
        return true // 异步响应
      }

      case 'FILL_REPLY': {
        // Side Panel → Content Script 填充
        chrome.tabs.sendMessage(
          msg.payload.tabId,
          { type: 'FILL_REPLY', payload: { content: msg.payload.content } },
          (result: any) => {
            const err = chrome.runtime.lastError
            if (err) sendResponse({ ok: false, error: err.message })
            else sendResponse({ ok: true, result })
          },
        )
        return true // 异步响应
      }

      case 'TEST_CONNECTION': {
        // Phase 5 实现 AI Provider 连接测试
        sendResponse({ ok: false, error: 'Not implemented yet' })
        break
      }
    }
  })

  // ===== 点击扩展图标打开 Side Panel =====
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return
    chrome.sidePanel.open({ tabId: tab.id })

    // 兜底：Side Panel 打开时主动触发一次提取
    chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_EXTRACT' }, () => {
      void chrome.runtime.lastError
    })
  })
})
