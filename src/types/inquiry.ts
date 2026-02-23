export type Platform = 'rakuten' | 'mercari' | 'amazon'

export type ThreadRole = 'customer' | 'staff' | 'system'

export interface ThreadMessage {
  role: ThreadRole
  time?: string
  text: string
}

export type FulfillmentStatus = 'not_shipped' | 'shipping' | 'delivered' | 'unknown'

export interface InquiryData {
  platform: Platform
  inquiryId: string
  customerName: string
  category?: string
  inquiryContent: string
  orderNumber?: string
  receivedTime?: string
  additionalInfo?: Record<string, string>

  /** 结构化会话线程（客户+客服双方，按时间顺序，最近 20 条） */
  thread?: ThreadMessage[]
  /** 订单/物流状态（保守识别，识别不了就 unknown） */
  fulfillmentStatus?: FulfillmentStatus
}
