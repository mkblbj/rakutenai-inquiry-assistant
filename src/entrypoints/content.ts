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

    let extractTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleExtract() {
      if (extractTimer) clearTimeout(extractTimer)
      void tryExtract()
      setTimeout(() => { void tryExtract() }, 500)
      extractTimer = setTimeout(() => { void tryExtract() }, 1500)
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

    // === URL 变化检测（多重策略覆盖各种 SPA 路由方式） ===

    let lastUrl = location.href
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        console.log('[ContentScript] URL changed:', lastUrl, '→', location.href)
        lastUrl = location.href
        handleRouteChange()
      }
    }

    // 策略 1: 拦截 history.pushState / replaceState
    const origPushState = history.pushState.bind(history)
    const origReplaceState = history.replaceState.bind(history)
    history.pushState = (...args) => { origPushState(...args); checkUrlChange() }
    history.replaceState = (...args) => { origReplaceState(...args); checkUrlChange() }
    window.addEventListener('popstate', checkUrlChange)

    // 策略 2: 轮询 URL（兜底：某些框架在 pushState 之前已缓存原始引用，
    //         或使用 Navigation API / location.href 赋值等我们无法拦截的方式）
    const urlPollInterval = setInterval(checkUrlChange, 800)

    // 策略 3: MutationObserver 监听 DOM 变化
    // 当 DOM 发生大量变化时（SPA 路由切换的典型特征），检查 URL 并触发重新提取
    let mutationDebounce: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (mutationDebounce) clearTimeout(mutationDebounce)
      mutationDebounce = setTimeout(() => {
        checkUrlChange()
        // 即使 URL 没变，inquiryId 也可能从 URL 以外的地方变化
        // 比如 master-detail 布局中只更新了右侧面板
        if (extractor) {
          void tryExtract()
        }
      }, 300)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false,
    })

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
      clearInterval(urlPollInterval)
      if (mutationDebounce) clearTimeout(mutationDebounce)
      observer.disconnect()
      chrome.runtime.onMessage.removeListener(messageHandler)
    })
  },
})
