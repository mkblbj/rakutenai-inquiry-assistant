---
name: copilot-dom-only-plan
overview: "MVP: 将助手定位为客服 Copilot，通过 DOM 线程抽取 + Shop Profile 注入 + 两步草稿流 + 填充门禁，解决瞎回答问题。不引入后端 API。"
todos:
  - id: types-thread-model
    content: 扩展 InquiryData：加入 ThreadMessage[]、FulfillmentStatus、保留 inquiryContent 兜底
    status: completed
  - id: shop-profile-settings
    content: Settings 加 ShopProfile（退换货/取消/运费/流程/落款），设置页加 TextArea 维护
    status: completed
  - id: extractor-thread
    content: RakutenExtractor 升级：从单段 content 到 thread 抽取（DOM 结构化解析，最近 20 条）
    status: completed
  - id: extractor-fulfillment
    content: RakutenExtractor：保守识别订单/物流状态（有就填，没有就 unknown）
    status: completed
  - id: copilot-prompt
    content: 重写 buildSystemPrompt：Copilot 固定骨架 + ShopProfile 注入 + thread 注入 + Markdown 五段式输出
    status: completed
  - id: ui-two-step
    content: ChatPanel 改为两步走：生成草稿 -> 确认后生成最终版；填充按钮加门禁
    status: completed
  - id: ui-context-card
    content: ContextCard 升级：显示最近 N 条对话 + 订单状态 + 店铺规则摘要
    status: completed
  - id: acceptance-tests
    content: 6 个固定场景回归测试（买错换货/未发货取消/已发货取消/瑕疵换货/地址错误/物流延迟）
    status: completed
isProject: false
---

# Copilot MVP 实施计划

## MVP 目标（只做 4 件事）

1. **Prompt 契约改 Copilot**：缺信息就列"需要确认"，禁止假设订单状态/店铺政策。
2. **上下文从"最后一句"升级为"最近 N 条对话"**（DOM 线程抽取）。
3. **引入 Shop Profile**（店铺规则配置）并注入 Prompt：退换货/取消/运费/流程。
4. **UI 改为两步走**：先"生成草稿（含确认项）"，确认后"生成最终可发版"，填充只对最终版开放。

## 暂不做

- 后端 Rakuten API 接入 / 多店铺凭证管理。
- 网络抓包（fetch/XHR hook）。
- JSON 结构化输出（MVP 用 Markdown 五段式，兼容现有 XMarkdown 渲染）。

---

## 1. 数据模型改造

修改 [src/types/inquiry.ts](src/types/inquiry.ts)：

- 新增 `ThreadMessage`（role + time + text）和 `FulfillmentStatus`。
- `InquiryData` 增加 `thread?: ThreadMessage[]` 和 `fulfillmentStatus?: FulfillmentStatus`。
- 保留 `inquiryContent` 兜底（thread 为空时降级使用）。

```typescript
export type ThreadRole = 'customer' | 'staff' | 'system'

export interface ThreadMessage {
  role: ThreadRole
  time?: string
  text: string
}

export type FulfillmentStatus = 'not_shipped' | 'shipping' | 'delivered' | 'unknown'
```

验收：ContextCard 能显示"最近 N 条对话 + 订单状态(若有)"。

---

## 2. Extractor 改造（DOM 线程抽取）

修改 [src/extractors/rakuten.ts](src/extractors/rakuten.ts)：

- 保留现有 `inquiryContent` 抓取（兜底）。
- 新增 `extractThread(): ThreadMessage[]`：
  - 基于现有 `parseMessagesFromText()` 升级，把"客户消息拼接字符串"改为"结构化 ThreadMessage 数组"。
  - 同时抓客户消息和客服消息（当前只抓客户的，对话不完整）。
  - 截取最近 20 条。
- 新增 `extractFulfillmentStatus(): FulfillmentStatus`：
  - 保守识别：页面有"発送前/発送済/配達完了/受取済"文案就映射，否则 `unknown`。

验收：同一问询页面，SidePanel 能看到 thread（至少 5-20 条），状态字段有值或 unknown。

---

## 3. Settings 增加 Shop Profile

修改 [src/stores/settings.ts](src/stores/settings.ts) 和 [src/components/Settings/index.tsx](src/components/Settings/index.tsx)：

```typescript
export interface ShopProfile {
  shopName?: string
  returnPolicy?: string      // 退货规则
  exchangePolicy?: string    // 换货规则
  cancelPolicy?: string      // 取消规则（未发货/已发货分界）
  shippingPolicy?: string    // 运费承担/补发
  processNotes?: string      // 常用流程（寄回地址、步骤）
  signature?: string         // 店铺落款模板
}
```

- Settings state 加 `shopProfile: ShopProfile` + `setShopProfile`。
- 设置页放 4-6 个 TextArea，让运营/客服自己维护规则文本。

验收：设置页写入"已签收换货流程"后，下次生成草稿时模型引用该规则。

---

## 4. Prompt 重构（核心）

修改 [src/utils/build-system-prompt.ts](src/utils/build-system-prompt.ts)：

**拼接结构（优先级从上到下）：**

1. Copilot 固定骨架（角色 + 禁止事项 + 输出格式）- 不可被 customPrompt 覆盖
2. Shop Profile 注入（从 settings 读取）
3. 问询上下文（inquiryId/customerName/orderNumber/fulfillmentStatus/category）
4. 会话历史（优先 thread，thread 为空时降级 inquiryContent）
5. customPrompt 作为"附加规则"追加（不替换骨架）

**Markdown 五段式输出格式：**

```
✅ 推荐回复（草稿）
（下书き。必要なら {注文状況} などのプレースホルダーを使ってよい）

🔎 需要确认
- [ ] （担当者に確認が必要な項目。無ければ「なし」）

🧩 已使用的前提/依据
- （どの事実・どの店舗ルールを根拠にしたか）

⚠️ 风险提示
- （誤案内になり得るポイント）

📌 最终可发送版本
（「需要确认」が"なし"の場合のみ出力。確認が必要なら空欄）
```

**Copilot 骨架要点：**

- 禁止推测注文状况（未発送/発送済/配達済）。
- 禁止推测店铺政策（返品可否、期限、送料負担）。
- 会話/店舗ルールに存在しない事実を作らない。
- 不明点 -> 先出確認項目 -> 不给確定手順。

---

## 5. UI 交互改造（两步走 + 填充门禁）

### 5.1 ChatPanel 按钮/QuickPrompts 改造

修改 [src/components/ChatPanel/index.tsx](src/components/ChatPanel/index.tsx) 和 [src/components/ChatPanel/QuickPrompts.tsx](src/components/ChatPanel/QuickPrompts.tsx)：

- "生成回复"改为"生成草稿（需确认）"（永远可点）。
- 新增"生成最终回复"（需"确认项为空/已确认"才可点）。

### 5.2 填充门禁

修改 [src/components/ChatPanel/index.tsx](src/components/ChatPanel/index.tsx)：

- 填充按钮仅在以下条件启用：
  - 模型输出 `📌 最终可发送版本` 非空，**或**
  - `🔎 需要确认` 为 `なし` 且 `✅ 推荐回复` 不含占位符（如 `{注文状況}`）
- MVP 不做 checkbox 交互，仅做文本检测。
- `onFillReply` 提取"最终可发送版本"段落内容（不是整个输出）。

### 5.3 ContextCard 升级

修改 [src/components/ChatPanel/ContextCard.tsx](src/components/ChatPanel/ContextCard.tsx)：

- 显示最近 N 条对话摘要（折叠展开）。
- 显示订单状态标签（有/unknown）。

---

## 6. 验收场景（必须覆盖）


| 场景              | 期望行为                                |
| --------------- | ----------------------------------- |
| 买错了想交换（签收状态未知）  | 确认项必须问"是否已签收"；风险提示"配達済みにキャンセル案内はNG" |
| 未发货可取消          | 若 Shop Profile 有取消规则则引用，给出取消流程草稿    |
| 已发货无法取消         | 引导拒收/到货后退货（取决店铺规则）                  |
| 商品瑕疵换货/补发       | 引用换货规则，列出需确认的瑕疵详情                   |
| 地址错误（未发货/已发货分流） | 确认项必须问发货状态                          |
| 物流延迟催促          | 引用物流状态或询问                           |


