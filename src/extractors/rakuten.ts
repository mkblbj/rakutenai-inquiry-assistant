import type { PlatformExtractor, InquiryData } from './types'

// R-Messe 页面 DOM 选择器 (需要根据实际页面调整)
const SELECTORS = {
  inquiryId: '.inquiry-number, [data-inquiry-id]',
  customerName: '.customer-name, .inquiry-customer',
  category: '.inquiry-category, .category-label',
  content: '.inquiry-content, .message-body',
  orderNumber: '.order-number, [data-order-number]',
  receivedTime: '.received-time, .inquiry-date',
  replyTextarea: 'textarea.reply-input, textarea[name="reply"]',
} as const

export class RakutenExtractor implements PlatformExtractor {
  platform = 'rakuten' as const

  match(url: string): boolean {
    return url.includes('rmesse.rms.rakuten.co.jp')
  }

  async extract(): Promise<InquiryData | null> {
    try {
      const inquiryId = this.getText(SELECTORS.inquiryId)
      if (!inquiryId) return null

      return {
        platform: 'rakuten',
        inquiryId,
        customerName: this.getText(SELECTORS.customerName) || '不明',
        category: this.getText(SELECTORS.category) ?? undefined,
        inquiryContent: this.getText(SELECTORS.content) || '',
        orderNumber: this.getText(SELECTORS.orderNumber) ?? undefined,
        receivedTime: this.getText(SELECTORS.receivedTime) ?? undefined,
      }
    } catch {
      return null
    }
  }

  async fillReply(content: string): Promise<boolean> {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      SELECTORS.replyTextarea,
    )
    if (!textarea) return false

    // 兼容 React 受控组件
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set
    nativeInputValueSetter?.call(textarea, content)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    textarea.focus()

    return true
  }

  getInquiryId(): string | null {
    return this.getText(SELECTORS.inquiryId)
  }

  private getText(selector: string): string | null {
    const selectors = selector.split(',').map((s) => s.trim())
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el?.textContent?.trim()) return el.textContent.trim()
    }
    return null
  }
}
