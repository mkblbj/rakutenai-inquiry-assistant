import { ExtractorFactory } from '@/extractors/factory'

export default defineContentScript({
  matches: [
    'https://rmesse.rms.rakuten.co.jp/*',
    'https://*.mercari.com/mypage/messages/*',
    'https://sellercentral.amazon.co.jp/*',
  ],
  main(ctx) {
    console.log('[ContentScript] init, URL:', location.href)
    let extractor = ExtractorFactory.create(location.href)
    console.log('[ContentScript] extractor:', extractor ? extractor.platform : 'none')
    if (!extractor) return

    // 用 JSON hash 比较，而不是只比 inquiryId
    // 这样首次数据不完整时，第二次有更多字段也会触发更新
    let lastDataHash: string | null = null

    async function tryExtract() {
      console.log('[ContentScript] tryExtract called')
      const data = await extractor?.extract()
      const hash = data ? JSON.stringify(data) : null
      console.log('[ContentScript] extracted:', hash?.slice(0, 300) ?? 'null')

      if (data && hash !== lastDataHash) {
        lastDataHash = hash
        chrome.runtime.sendMessage({ type: 'INQUIRY_DATA', payload: data })
        console.log('[ContentScript] sent INQUIRY_DATA')
      } else if (data) {
        console.log('[ContentScript] data unchanged, skip')
      }
    }

    function scheduleExtract() {
      void tryExtract()
      // 延迟重试：SPA 异步渲染可能导致首次提取不完整
      setTimeout(() => { void tryExtract() }, 500)
      setTimeout(() => { void tryExtract() }, 1500)
    }

    function handleRouteChange() {
      chrome.runtime.sendMessage({
        type: 'PAGE_CHANGED',
        payload: { url: location.href },
      })
      extractor = ExtractorFactory.create(location.href)
      lastDataHash = null
      if (extractor) scheduleExtract()
    }

    scheduleExtract()

    let lastUrl = location.href
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        handleRouteChange()
      }
    }

    const origPushState = history.pushState.bind(history)
    const origReplaceState = history.replaceState.bind(history)
    history.pushState = (...args) => { origPushState(...args); checkUrlChange() }
    history.replaceState = (...args) => { origReplaceState(...args); checkUrlChange() }
    window.addEventListener('popstate', checkUrlChange)

    const messageHandler = (msg: any, _sender: any, sendResponse: any) => {
      if (msg.type === 'REQUEST_EXTRACT') {
        console.log('[ContentScript] received REQUEST_EXTRACT')
        scheduleExtract()
        return
      }
      if (msg.type === 'FILL_REPLY') {
        extractor?.fillReply(msg.payload.content).then(sendResponse)
        return true
      }
    }
    chrome.runtime.onMessage.addListener(messageHandler)

    ctx.onInvalidated(() => {
      history.pushState = origPushState
      history.replaceState = origReplaceState
      window.removeEventListener('popstate', checkUrlChange)
      chrome.runtime.onMessage.removeListener(messageHandler)
    })
  },
})
