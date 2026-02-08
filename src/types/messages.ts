import type { InquiryData } from './inquiry'
import type { Message } from './message'

// ========== Content Script → Background ==========

/** 页面数据提取完成 */
export interface InquiryDataMessage {
  type: 'INQUIRY_DATA'
  payload: InquiryData
}

/** 页面 URL 变化 (SPA 路由切换) */
export interface PageChangedMessage {
  type: 'PAGE_CHANGED'
  payload: { url: string }
}

// ========== Background → Side Panel ==========

/** 通知 Side Panel 问询数据更新 */
export interface InquiryUpdatedMessage {
  type: 'INQUIRY_UPDATED'
  payload: InquiryData & { tabId: number }
}

/** 通知 Side Panel：当前 Tab/页面上下文变化 */
export interface TabChangedMessage {
  type: 'TAB_CHANGED'
  payload: { tabId: number; url: string }
}

/** 通知 Side Panel Tab 关闭 */
export interface TabClosedMessage {
  type: 'TAB_CLOSED'
  payload: { tabId: number }
}

// ========== Side Panel → Background ==========

/** 请求抓取当前页面数据 */
export interface RequestExtractMessage {
  type: 'REQUEST_EXTRACT'
  payload: { tabId: number }
}

/** 请求填充回复到页面 */
export interface FillReplyMessage {
  type: 'FILL_REPLY'
  payload: { tabId: number; content: string }
}

/** 测试 AI Provider 连接 */
export interface TestConnectionMessage {
  type: 'TEST_CONNECTION'
  payload?: { apiUrl?: string; apiKey?: string; model?: string }
}

export type TestConnectionResponse = { ok: boolean; error?: string }

/** 获取可用模型列表 */
export interface FetchModelsMessage {
  type: 'FETCH_MODELS'
  payload?: { apiUrl?: string; apiKey?: string }
}

export type FetchModelsResponse = {
  ok: boolean
  models?: Array<{ id: string; name: string }>
  error?: string
}

// ========== 流式 AI 对话 (Port 长连接) ==========

/** Side Panel → Background: 开始流式对话 */
export interface StartStreamMessage {
  type: 'START_STREAM'
  payload: {
    messages: Array<{ role: string; content: string }>
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

/** Background → Side Panel: 流式响应 */
export type StreamResponse =
  | { type: 'STREAM_CHUNK'; content: string }
  | { type: 'STREAM_THINKING'; content: string }
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; error: string }

/** Side Panel → Background: 中断流式 */
export interface AbortStreamMessage {
  type: 'ABORT_STREAM'
}

// ========== 聚合类型 ==========

export type RuntimeMessage =
  | InquiryDataMessage
  | PageChangedMessage
  | InquiryUpdatedMessage
  | TabChangedMessage
  | TabClosedMessage
  | RequestExtractMessage
  | FillReplyMessage
  | TestConnectionMessage
  | FetchModelsMessage

export type PortMessage =
  | StartStreamMessage
  | AbortStreamMessage
  | StreamResponse
