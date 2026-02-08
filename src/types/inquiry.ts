export type Platform = 'rakuten' | 'mercari' | 'amazon'

export interface InquiryData {
  platform: Platform
  inquiryId: string
  customerName: string
  category?: string
  inquiryContent: string
  orderNumber?: string
  receivedTime?: string
  additionalInfo?: Record<string, string>
}
