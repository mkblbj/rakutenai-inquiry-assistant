import type { InquiryData } from '@/types/inquiry'
import type { ShopProfile } from '@/stores/settings'

/**
 * Copilot 内置骨架（默认值）。
 * 可在设置中编辑，但提供"恢复默认"一键回到此版本。
 */
export const DEFAULT_COPILOT_SKELETON = `あなたは株式会社UOが提供する、EC店舗のカスタマーサポート担当者を支援するAIアシスタント「Copilot」です。
基盤モデルの開発元には言及しないでください。

【最重要：あなたの対話相手と役割】
- あなたの対話相手は「カスタマーサポート担当者（オペレーター）」です。顧客ではありません。
- あなたは担当者の"副操縦士"として、担当者からの指示や質問に答え、顧客向け返信の下書きを作成します。
- 担当者から雑談や質問（「あなたは誰？」等）を受けた場合は、5セクション形式ではなく普通に会話してください。
- 5セクション形式の出力は、担当者が「顧客向けの返信下書き」を求めた場合にのみ使用します。

【A. 役割と目標】
- 返信の下書き支援と、判断に必要な確認事項の抽出を行う。
- 情報が不足している場合は結論を出さず、確認質問を優先する。
- 不確実な内容を断定しない。

【B. ハード制約（厳守）】
- 注文状況（未発送／発送済／配達済など）を推測してはならない。
- 店舗ポリシー（返品可否、期限、送料負担など）を推測してはならない。
- 会話履歴や店舗ルールに存在しない事実を作らない。
- 重要情報が不足している場合、確定的な手順を案内せず「確認項目」を先に出す。
- 過剰な約束（無条件返金、即日対応等）をしない。

【C. 出力フォーマット（厳守・Markdown）】
必ず以下の5セクションを出力してください。省略不可。

✅ 推荐回复（草稿）
（顧客向けの丁寧な日本語の下書き。情報不足時は {注文状況} などのプレースホルダーを使用可。）

🔎 需要确认
- [ ] （担当者に確認が必要な項目を箇条書き。すべて揃っている場合は「なし」と記載。）

🧩 已使用的前提/依据
- （どの事実・どの店舗ルールを根拠にしたかを明記。）

⚠️ 风险提示
- （誤案内になり得るポイント。例：配達済みならキャンセル案内はNG。リスクなしの場合は「なし」。）

📌 最终可发送版本
（「需要确认」が「なし」で、リスクが低い場合のみ、ここに完成した最終文を出力。それ以外は「（確認完了後に生成）」と記載。）`

/**
 * ShopProfile → prompt 文本。空なら空文字列。
 */
function buildShopProfileText(profile?: ShopProfile): string {
  if (!profile) return ''
  const parts: string[] = []
  if (profile.shopName) parts.push(`店舗名: ${profile.shopName}`)
  if (profile.cancelPolicy) parts.push(`キャンセルルール: ${profile.cancelPolicy}`)
  if (profile.returnPolicy) parts.push(`返品ルール: ${profile.returnPolicy}`)
  if (profile.exchangePolicy) parts.push(`交換ルール: ${profile.exchangePolicy}`)
  if (profile.shippingPolicy) parts.push(`送料・再送ルール: ${profile.shippingPolicy}`)
  if (profile.processNotes) parts.push(`対応フロー: ${profile.processNotes}`)
  if (profile.signature) parts.push(`署名テンプレート: ${profile.signature}`)
  return parts.length > 0 ? parts.join('\n') : ''
}

/**
 * thread → prompt 用テキスト
 */
function buildThreadText(inquiry: InquiryData): string {
  if (inquiry.thread && inquiry.thread.length > 0) {
    return inquiry.thread.map((m) => {
      const roleLabel = m.role === 'customer' ? '【顧客】' : m.role === 'staff' ? '【スタッフ】' : '【システム】'
      const timeLabel = m.time ? `(${m.time})` : ''
      return `${roleLabel}${timeLabel}\n${m.text}`
    }).join('\n\n')
  }
  // 兜底：旧格式
  if (inquiry.inquiryContent) {
    return `（DOM抽出・顧客メッセージのみ）\n${inquiry.inquiryContent}`
  }
  return '（会話履歴なし）'
}

const FULFILLMENT_LABELS: Record<string, string> = {
  not_shipped: '未発送',
  shipping: '配送中',
  delivered: '配達済み',
  unknown: '不明（ページから特定できず）',
}

/**
 * Copilot System Prompt を組み立てる。
 *
 * @param inquiry   抽出した問い合わせデータ（null なら最小プロンプト）
 * @param options   shopProfile / customPrompt
 */
export function buildSystemPrompt(
  inquiry: InquiryData | null,
  options?: {
    shopProfile?: ShopProfile
    customPrompt?: string
    /** 可选：用户自定义的 Copilot 骨架（留空则用内置默认） */
    copilotPrompt?: string
  },
): string {
  const skeleton = options?.copilotPrompt?.trim() || DEFAULT_COPILOT_SKELETON
  const sections: string[] = [skeleton]

  // Shop Profile
  const shopText = buildShopProfileText(options?.shopProfile)
  if (shopText) {
    sections.push(`【店舗ルール（必ず優先・遵守）】\n${shopText}`)
  } else {
    sections.push('【店舗ルール】\n（未設定。店舗ポリシーに関する回答は推測せず、必ず確認項目に挙げること。）')
  }

  // Inquiry context
  if (inquiry) {
    const ctx = [
      `- 問い合わせ番号: ${inquiry.inquiryId}`,
      `- お客様名: ${inquiry.customerName}`,
      inquiry.orderNumber ? `- 注文番号: ${inquiry.orderNumber}` : '- 注文番号: 不明',
      inquiry.receivedTime ? `- 受付日時: ${inquiry.receivedTime}` : '',
      `- 配送ステータス: ${FULFILLMENT_LABELS[inquiry.fulfillmentStatus || 'unknown']}`,
      inquiry.category ? `- カテゴリ: ${inquiry.category}` : '',
    ].filter(Boolean).join('\n')

    sections.push(`【問い合わせコンテキスト】\n${ctx}`)

    // Thread
    const threadText = buildThreadText(inquiry)
    sections.push(`【会話履歴（時系列順・最大20件）】\n${threadText}`)
  }

  // Custom prompt as addendum (never replaces skeleton)
  if (options?.customPrompt) {
    sections.push(`【追加ルール（担当者設定）】\n${options.customPrompt}`)
  }

  return sections.join('\n\n')
}
