import type { Platform, InquiryData } from '@/types/inquiry'

export type { InquiryData }

export interface PlatformExtractor {
  platform: Platform

  /** 检测当前页面是否匹配 */
  match(url: string): boolean

  /** 提取问询数据 */
  extract(): Promise<InquiryData | null>

  /** 填充回复到页面 */
  fillReply(content: string): Promise<boolean>

  /** 获取唯一问询 ID */
  getInquiryId(): string | null
}
