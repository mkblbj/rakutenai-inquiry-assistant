export default defineBackground(() => {
  console.log('Background service worker started')

  // 点击扩展图标打开 Side Panel
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return
    chrome.sidePanel.open({ tabId: tab.id })
  })
})
