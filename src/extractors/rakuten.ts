import type { PlatformExtractor, InquiryData } from './types'
import type { ThreadMessage, FulfillmentStatus } from '@/types/inquiry'

const REPLY_TEXTAREA_SELECTORS = [
  'textarea[placeholder="ここに返信を記入してください"]',
  'textarea.reply-input',
  'textarea[name="reply"]',
] as const

export class RakutenExtractor implements PlatformExtractor {
  platform = 'rakuten' as const

  match(url: string): boolean {
    return url.includes('rmesse.rms.rakuten.co.jp')
  }

  async extract(): Promise<InquiryData | null> {
    try {
      const inquiryId = this.getInquiryId()
      if (!inquiryId) return null

      // === 从侧边栏找到精确匹配当前 inquiryId 的卡片 ===
      const cardLink = this.findInquiryCardLink(inquiryId)
      const cardText = this.normalizeText((cardLink as HTMLElement | null)?.innerText)

      const category = this.parseCategory(cardText) ?? undefined
      const receivedTime = this.parseReceivedTime(cardText) ?? undefined
      // === 线程抽取（客户+客服双方） ===
      const thread = this.extractThread()
      // 兜底：从 thread 生成 inquiryContent
      const inquiryContent = thread.length > 0
        ? thread.filter((m) => m.role === 'customer').map((m) => m.text).join('\n---\n')
        : this.extractInquiryContentLegacy(cardText)

      // === 从右侧"顧客情報"面板取客户真实姓名 ===
      const customerName = this.extractCustomerNameFromPanel()
        || this.parseCustomerNameFromCard(cardText)
        || '不明'

      // === 订单号 ===
      const orderNumber = this.extractOrderNumber() ?? undefined

      // === 物流状态 ===
      const fulfillmentStatus = this.extractFulfillmentStatus()

      const data: InquiryData = {
        platform: 'rakuten',
        inquiryId,
        customerName,
        category,
        inquiryContent,
        orderNumber,
        receivedTime,
        thread: thread.length > 0 ? thread : undefined,
        fulfillmentStatus,
      }
      console.log('[RakutenExtractor] result:', JSON.stringify(data))
      return data
    } catch (err) {
      console.error('[RakutenExtractor] extract error:', err)
      return null
    }
  }

  async fillReply(content: string): Promise<boolean> {
    const textarea = this.findReplyTextarea()
    if (!textarea) return false

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set

    nativeInputValueSetter?.call(textarea, content)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    textarea.focus()
    textarea.selectionStart = textarea.value.length
    textarea.selectionEnd = textarea.value.length

    return true
  }

  getInquiryId(): string | null {
    return location.pathname.match(/\/inquiry\/([^/?#]+)/)?.[1] ?? null
  }

  // ===== 私有方法 =====

  private findReplyTextarea(): HTMLTextAreaElement | null {
    for (const selector of REPLY_TEXTAREA_SELECTORS) {
      const el = document.querySelector<HTMLTextAreaElement>(selector)
      if (el) return el
    }
    return null
  }

  /**
   * 精确匹配当前 inquiryId 的卡片链接。
   * 如果当前问询的卡片不在侧边栏（被筛选器隐藏了），返回 null。
   * 绝不 fallback 到其他问询的卡片。
   */
  private findInquiryCardLink(inquiryId: string): HTMLAnchorElement | null {
    const allLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/inquiry/"]'),
    )
    // 只保留包含 "様" 的（问询卡片链接）
    const cardLinks = allLinks.filter((link) => (link.textContent || '').includes('様'))

    // 严格匹配 href 中包含当前 inquiryId
    const matched = cardLinks.find((link) => {
      const href = link.getAttribute('href') || ''
      return href.includes(inquiryId)
    })

    console.log('[RakutenExtractor] cards:', cardLinks.length, 'matched:', !!matched)
    return matched ?? null // 不匹配就返回 null，不 fallback
  }

  /**
   * 从右侧"顧客情報"面板提取客户真实姓名。
   * 策略：找到 h3 "顧客情報"，然后向上遍历找到包含完整信息的容器。
   */
  private extractCustomerNameFromPanel(): string | null {
    const headings = Array.from(document.querySelectorAll('h2, h3'))
    const customerHeading = headings.find((h) =>
      (h.textContent || '').trim() === '顧客情報',
    )
    if (!customerHeading) return null

    // 尝试多种方式获取包含客户信息的容器
    let sectionText = ''

    // 方法1: 从标题往上找更大的容器（最多5层）
    let parent: HTMLElement | null = customerHeading.parentElement
    for (let i = 0; i < 5 && parent; i++) {
      const text = parent.innerText || ''
      // 找到包含地址标记（〒）或电话的容器，说明拿到了完整的客户信息
      if (text.includes('〒') || text.includes('顧客詳細')) {
        sectionText = text
        break
      }
      parent = parent.parentElement
    }

    // 方法2: 如果方法1没拿到，尝试标题后面的兄弟节点
    if (!sectionText) {
      let sibling = customerHeading.nextElementSibling
      const parts: string[] = []
      while (sibling) {
        parts.push((sibling as HTMLElement).innerText || sibling.textContent || '')
        if (parts.join('').includes('〒') || parts.join('').includes('顧客管理')) break
        sibling = sibling.nextElementSibling
      }
      sectionText = parts.join('\n')
    }

    console.log('[RakutenExtractor] 顧客情報 panel:', sectionText.slice(0, 200))

    if (!sectionText) return null

    // 面板结构固定：
    //   顧客情報
    //   ササキ キミコ        ← 读音（片假名，可选）
    //   佐々木 貴美子        ← 客户名 ← 总是在「楽天会員/ゲスト/顧客詳細」之前
    //   楽天会員 / ゲスト
    //   顧客詳細へ
    //   〒...
    //
    // 策略：找到「楽天会員」「ゲスト」「顧客詳細」所在行，取其前一行作为客户名。
    const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean)
    const anchorIndex = lines.findIndex((l) =>
      /楽天会員|ゲスト|顧客詳細/.test(l),
    )

    if (anchorIndex > 0) {
      const name = lines[anchorIndex - 1]
      // 排除标题行本身
      if (name !== '顧客情報') return name
    }

    return null
  }

  private parseCustomerNameFromCard(text: string): string | null {
    if (!text) return null
    const match = text.match(/(\S+)\s+様/)
    return match?.[1]?.trim() || null
  }

  private parseCategory(text: string): string | null {
    if (!text) return null
    const match = text.match(/^(.+?)\s+\S+\s+様/)
    return match?.[1]?.trim() || null
  }

  private parseReceivedTime(text: string): string | null {
    if (!text) return null
    const match = text.match(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\s*受付/)
    return match?.[1]?.trim() || null
  }

  /**
   * 从页面全文中提取结构化会话线程（客户+客服双方）。
   * 最近 20 条。
   */
  private extractThread(): ThreadMessage[] {
    const sources = this.collectTextSources()
    for (const text of sources) {
      const result = this.parseThreadFromText(text)
      if (result.length > 0) return result.slice(-20)
    }
    return []
  }

  /**
   * 保守识别订单/物流状态。
   * 只匹配页面上明确出现的状态文案，否则返回 unknown。
   */
  private extractFulfillmentStatus(): FulfillmentStatus {
    const pageText = document.body?.innerText || ''
    // 优先匹配更具体的状态
    if (/配達完了|配達済み|受取済|お届け済み/.test(pageText)) return 'delivered'
    if (/発送済み?|出荷済み?|配送中/.test(pageText)) return 'shipping'
    if (/未発送|発送前|発送待ち/.test(pageText)) return 'not_shipped'
    return 'unknown'
  }

  /** 兜底：旧版从 thread 无法解析时使用 */
  private extractInquiryContentLegacy(_cardText: string): string {
    const sources = this.collectTextSources()
    for (const text of sources) {
      const result = this.parseMessagesFromTextLegacy(text)
      if (result) return result
    }
    return ''
  }

  /**
   * 收集所有可能包含聊天消息的文本来源：主文档 + 所有同源 iframe。
   */
  private collectTextSources(): string[] {
    const sources: string[] = []
    const bodyText = document.body?.innerText || ''
    sources.push(bodyText)

    // 检查 iframe（聊天区可能在 iframe 内）
    const iframes = document.querySelectorAll('iframe')
    console.log('[RakutenExtractor] bodyLen:', bodyText.length,
      'has自動応答終了:', bodyText.includes('自動応答終了'),
      'hasAI:', bodyText.includes('AIで回答文を生成'),
      'iframes:', iframes.length)

    for (const iframe of Array.from(iframes)) {
      try {
        const doc = (iframe as HTMLIFrameElement).contentDocument
        if (doc?.body) {
          const t = doc.body.innerText || ''
          if (t.length > 50) sources.push(t)
        }
      } catch { /* cross-origin, skip */ }
    }

    // 检查 Shadow DOM（遍历主文档中带 shadowRoot 的元素）
    const shadowHosts = document.querySelectorAll('*')
    for (const host of Array.from(shadowHosts)) {
      const sr = (host as HTMLElement).shadowRoot
      if (sr) {
        const t = (sr as unknown as HTMLElement).textContent || ''
        if (t.length > 50 && t.includes('様')) sources.push(t)
      }
    }

    return sources
  }

  /**
   * 从一段文本中提取结构化会话线程（客户+客服双方）。
   */
  private parseThreadFromText(fullText: string): ThreadMessage[] {
    const chatSection = this.extractChatSection(fullText)
    if (!chatSection) return []

    const lines = chatSection.split('\n').map((l) => l.trim()).filter(Boolean)
    const datePattern = /^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/

    const messages: ThreadMessage[] = []
    let cur: { role: 'customer' | 'staff'; time?: string; body: string[] } | null = null
    let expectNameLine = false

    for (const line of lines) {
      const dateMatch = line.match(datePattern)
      if (dateMatch) {
        if (cur && cur.body.length > 0) {
          messages.push({ role: cur.role, time: cur.time, text: cur.body.join('\n') })
        }
        cur = { role: 'staff', time: dateMatch[1], body: [] }
        expectNameLine = true
      } else if (expectNameLine && cur) {
        cur.role = /\s様\s*$/.test(line) ? 'customer' : 'staff'
        expectNameLine = false
      } else if (cur) {
        cur.body.push(line)
      }
    }
    if (cur && cur.body.length > 0) {
      messages.push({ role: cur.role, time: cur.time, text: cur.body.join('\n') })
    }

    console.log('[RakutenExtractor] thread parsed:', messages.length, 'messages')
    return messages
  }

  /**
   * 提取聊天区域文本（两个标记之间）。
   * 复用于新旧两种解析器。
   */
  private extractChatSection(fullText: string): string | null {
    const startMarker = '自動応答終了'
    const endMarker = 'AIで回答文を生成'

    let start = fullText.lastIndexOf(startMarker)
    if (start >= 0) {
      start += startMarker.length
    } else {
      start = fullText.search(/\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+\S+.*様/)
      if (start < 0) return null
    }

    let end = fullText.indexOf(endMarker, start)
    if (end < 0) {
      end = fullText.indexOf('ここに返信を記入してください', start)
    }
    if (end < 0) end = fullText.length

    const chatSection = fullText.slice(start, end).trim()
    if (!chatSection) return null

    console.log('[RakutenExtractor] chatSection len:', chatSection.length,
      'preview:', chatSection.slice(0, 300).replace(/\n/g, '↵'))
    return chatSection
  }

  /**
   * 旧版：从一段文本中提取客户消息（string 格式，兜底用）。
   */
  private parseMessagesFromTextLegacy(fullText: string): string | null {
    const chatSection = this.extractChatSection(fullText)
    if (!chatSection) return null

    const lines = chatSection.split('\n').map((l) => l.trim()).filter(Boolean)
    const datePattern = /\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/

    const blocks: Array<{ isCustomer: boolean; body: string[] }> = []
    let cur: { isCustomer: boolean; body: string[] } | null = null
    let expectNameLine = false

    for (const line of lines) {
      if (datePattern.test(line)) {
        if (cur) blocks.push(cur)
        cur = { isCustomer: false, body: [] }
        expectNameLine = true
      } else if (expectNameLine && cur) {
        cur.isCustomer = /\s様\s*$/.test(line)
        expectNameLine = false
      } else if (cur) {
        cur.body.push(line)
      }
    }
    if (cur) blocks.push(cur)

    const customerMsgs = blocks
      .filter((b) => b.isCustomer && b.body.length > 0)
      .map((b) => b.body.join('\n'))
      .filter(Boolean)

    if (customerMsgs.length === 0) return null
    return customerMsgs.join('\n---\n')
  }

  private extractOrderNumber(): string | null {
    // 方法1：找订单号格式的链接
    const orderLinks = Array.from(document.querySelectorAll('a'))
    for (const link of orderLinks) {
      const text = (link.textContent || '').trim()
      if (/^\d{6}-\d{8}-\d{10,}[a-z]?$/.test(text)) {
        return text
      }
    }
    // 方法2：从全文匹配
    const pageText = this.normalizeText(document.body?.innerText)
    if (!pageText) return null
    const match = pageText.match(/受注番号\s*[:：]?\s*(\d{6}-\d{8}-\d{10,}[a-z]?)/)
    return match?.[1] ?? null
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim()
  }
}
