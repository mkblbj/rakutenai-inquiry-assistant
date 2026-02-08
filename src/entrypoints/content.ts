export default defineContentScript({
  matches: [
    'https://rmesse.rms.rakuten.co.jp/*',
    'https://*.mercari.com/mypage/messages/*',
    'https://sellercentral.amazon.co.jp/*',
  ],
  main(ctx) {
    console.log('Content script loaded for:', location.href)
  },
})
