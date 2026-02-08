import { ExtractorFactory } from '@/extractors/factory'

export default defineContentScript({
  matches: [
    'https://rmesse.rms.rakuten.co.jp/*',
    'https://*.mercari.com/mypage/messages/*',
    'https://sellercentral.amazon.co.jp/*',
  ],
  main(ctx) {
    let extractor = ExtractorFactory.create(location.href)
    if (!extractor) return

    let lastInquiryId: string | null = null

    // 尝试提取并发送数据
    async function tryExtract() {
      const data = await extractor?.extract()
      if (data && data.inquiryId !== lastInquiryId) {
        lastInquiryId = data.inquiryId
        chrome.runtime.sendMessage({ type: 'INQUIRY_DATA', payload: data })
      }
    }

    // SPA 路由变化处理：重建 Extractor + 重新提取
    function handleRouteChange() {
      chrome.runtime.sendMessage({
        type: 'PAGE_CHANGED',
        payload: { url: location.href },
      })
      extractor = ExtractorFactory.create(location.href)
      lastInquiryId = null
      if (extractor) tryExtract()
    }

    // 首次提取
    tryExtract()

    // ===== SPA 路由监听 =====
    let lastUrl = location.href
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        handleRouteChange()
      }
    }

    // Hook history.pushState / replaceState
    const origPushState = history.pushState.bind(history)
    const origReplaceState = history.replaceState.bind(history)
    history.pushState = (...args) => { origPushState(...args); checkUrlChange() }
    history.replaceState = (...args) => { origReplaceState(...args); checkUrlChange() }

    // 监听浏览器前进/后退
    window.addEventListener('popstate', checkUrlChange)

    // 监听 Background 发来的指令
    const messageHandler = (msg: any, _sender: any, sendResponse: any) => {
      if (msg.type === 'REQUEST_EXTRACT') {
        tryExtract()
        return
      }
      if (msg.type === 'FILL_REPLY') {
        extractor?.fillReply(msg.payload.content).then(sendResponse)
        return true // 异步响应
      }
    }
    chrome.runtime.onMessage.addListener(messageHandler)

    // 扩展更新 / content script 失效时清理资源
    ctx.onInvalidated(() => {
      history.pushState = origPushState
      history.replaceState = origReplaceState
      window.removeEventListener('popstate', checkUrlChange)
      chrome.runtime.onMessage.removeListener(messageHandler)
    })
  },
})
