import type { InquiryData } from '@/types/inquiry'

const DEFAULT_PROMPT = `あなたは日本の EC サイトのカスタマーサポート担当者です。
丁寧で専門的な日本語で、お客様のお問い合わせに回答してください。
回答は簡潔で分かりやすく、必要に応じて箇条書きを使ってください。`

export function buildSystemPrompt(inquiry: InquiryData | null, customPrompt?: string): string {
  const base = customPrompt || DEFAULT_PROMPT

  if (!inquiry) return base

  return `${base}

【現在のお問い合わせ情報】
- お問い合わせ番号: ${inquiry.inquiryId}
- お客様名: ${inquiry.customerName}
${inquiry.category ? `- カテゴリー: ${inquiry.category}` : ''}
${inquiry.orderNumber ? `- 注文番号: ${inquiry.orderNumber}` : ''}
${inquiry.receivedTime ? `- 受付日時: ${inquiry.receivedTime}` : ''}

【お問い合わせ内容】
${inquiry.inquiryContent}

上記の情報に基づいて、適切な返信を作成してください。`
}
