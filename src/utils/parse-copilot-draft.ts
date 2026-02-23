/**
 * 解析 Copilot Markdown 五段式输出，提取各段落并判断填充资格。
 */

export interface CopilotDraft {
  /** 推荐回复（草稿） */
  draftReply: string
  /** 需要确认的项目 */
  confirmItems: string
  /** 已使用的前提/依据 */
  assumptions: string
  /** 风险提示 */
  riskFlags: string
  /** 最终可发送版本 */
  finalVersion: string
}

export interface FillGateResult {
  /** 是否允许填充 */
  canFill: boolean
  /** 用于填充的文本（最终版优先，否则草稿） */
  fillContent: string
  /** 不能填充的原因 */
  blockReason?: string
}

const SECTION_MARKERS = {
  draft: '✅ 推荐回复（草稿）',
  confirm: '🔎 需要确认',
  assumptions: '🧩 已使用的前提/依据',
  risk: '⚠️ 风险提示',
  final: '📌 最终可发送版本',
} as const

/**
 * 从 Copilot 输出中提取各段落。
 * 容错：如果某段不存在就返回空字符串。
 */
export function parseCopilotDraft(content: string): CopilotDraft {
  const extract = (startMarker: string, endMarkers: string[]): string => {
    const startIdx = content.indexOf(startMarker)
    if (startIdx < 0) return ''

    const afterMarker = startIdx + startMarker.length
    let endIdx = content.length

    for (const marker of endMarkers) {
      const idx = content.indexOf(marker, afterMarker)
      if (idx >= 0 && idx < endIdx) endIdx = idx
    }

    return content.slice(afterMarker, endIdx).trim()
  }

  return {
    draftReply: extract(SECTION_MARKERS.draft, [SECTION_MARKERS.confirm, SECTION_MARKERS.assumptions, SECTION_MARKERS.risk, SECTION_MARKERS.final]),
    confirmItems: extract(SECTION_MARKERS.confirm, [SECTION_MARKERS.assumptions, SECTION_MARKERS.risk, SECTION_MARKERS.final]),
    assumptions: extract(SECTION_MARKERS.assumptions, [SECTION_MARKERS.risk, SECTION_MARKERS.final]),
    riskFlags: extract(SECTION_MARKERS.risk, [SECTION_MARKERS.final]),
    finalVersion: extract(SECTION_MARKERS.final, []),
  }
}

/**
 * 判断填充门禁。
 */
export function checkFillGate(content: string): FillGateResult {
  const draft = parseCopilotDraft(content)

  // 最终版有内容 → 可填充
  const finalClean = draft.finalVersion
    .replace(/（確認完了後に生成）/g, '')
    .replace(/\(確認完了後に生成\)/g, '')
    .trim()

  if (finalClean.length > 10) {
    return { canFill: true, fillContent: finalClean }
  }

  // 确认项为"なし" + 草稿无占位符 → 可填充草稿
  const confirmIsNone = /^-?\s*なし\s*$/m.test(draft.confirmItems) || draft.confirmItems === 'なし'
  const hasPlaceholder = /\{[^}]+\}/.test(draft.draftReply)

  if (confirmIsNone && !hasPlaceholder && draft.draftReply.length > 10) {
    return { canFill: true, fillContent: draft.draftReply }
  }

  // 不能填充
  if (!confirmIsNone) {
    return { canFill: false, fillContent: '', blockReason: 'confirm_pending' }
  }
  if (hasPlaceholder) {
    return { canFill: false, fillContent: '', blockReason: 'has_placeholder' }
  }
  return { canFill: false, fillContent: '', blockReason: 'no_content' }
}

/**
 * 检测内容是否为 Copilot 五段式格式
 */
export function isCopilotFormat(content: string): boolean {
  return content.includes(SECTION_MARKERS.draft) || content.includes(SECTION_MARKERS.confirm)
}
