export const zh = {
  // 通用
  settings: '设置',
  save: '保存',
  cancel: '取消',
  confirm: '确认',
  delete: '删除',
  copy: '复制',
  copied: '已复制',
  fill: '填充',
  filled: '已填充',
  loading: '加载中...',
  error: '错误',
  retry: '重试',

  // 欢迎
  welcomeTitle: 'AI 客服助手',
  welcomeDescription: '我可以帮您快速生成专业的客服回复',

  // 快捷操作
  promptGenerateReply: '生成回复',
  promptApologize: '礼貌道歉',
  promptConfirmOrder: '确认订单',
  promptShippingQuery: '物流查询',

  // 问询上下文
  contextTitle: '问询上下文',
  contextCustomer: '客户',
  contextCategory: '类别',
  contextOrderNumber: '订单号',

  // 输入
  inputPlaceholder: '输入消息，按 Enter 发送...',
  inputInitializing: '正在初始化...',

  // 对话
  messagesCount: '{0} 条消息',
  messagesClearConfirm: '确定清空对话？',

  // 设置页
  interfaceSettings: '界面设置',
  aiSettings: 'AI 设置',
  dialogSettings: '对话设置',
  language: '语言',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  provider: '服务商',
  customProvider: '自定义',
  apiUrl: 'API 地址',
  apiKey: 'API 密钥',
  model: '模型',
  testConnection: '测试连接',
  connectionSuccess: '连接成功',
  connectionFailed: '连接失败',
  connectionError: '连接错误',
  maxTokens: '最大 Token',
  streamOutput: '流式输出',
  copilotPromptLabel: 'Copilot 核心提示词',
  copilotPromptHint: '控制 AI 的角色定义、硬性约束和输出格式。修改后可能影响草稿质量，点击"恢复默认"可还原内置版本。',
  systemPromptLabel: '追加规则',
  systemPromptHint: '此处填写的内容会作为"追加规则"附加到 Copilot 内置提示词之后，不会替换核心指令。留空则仅使用内置提示词。',
  resetDefaults: '恢复默认',

  // 店铺规则
  shopProfileLabel: '店铺规则',
  shopName: '店铺名称',
  returnPolicy: '退货规则',
  exchangePolicy: '换货规则',
  cancelPolicy: '取消规则',
  shippingPolicy: '运费/补发规则',
  processNotes: '常用流程',
  signature: '落款模板',
  shopProfileHint: '填写店铺规则后，AI 将依据规则生成草稿',

  // 上下文增强
  contextThread: '对话记录',
  contextThreadCount: '{0} 条消息',
  contextFulfillment: '物流状态',
  fulfillmentNotShipped: '未发货',
  fulfillmentShipping: '配送中',
  fulfillmentDelivered: '已签收',
  fulfillmentUnknown: '未知',

  // Copilot
  promptGenerateDraft: '生成草稿',
  promptFinalize: '生成最终版',
  fillDraft: '填充草稿',
  fillBlocked: '有待确认项，无法直接填充',
  fillConfirmTitle: '确认填充',
  fillConfirmDesc: '草稿中存在风险提示，确认填充？',

  // Provider
  providerLabel: '服务商',
  providerOpenai: 'OpenAI 兼容',
  providerGemini: 'Gemini 原生',

  // Gemini 专用
  webSearchEnabled: '联网搜索',
  webSearchHint: '启用后模型会先搜索再回答，延迟略增',
  thinkingBudget: '思维链长度',
  thinkingBudgetHint: '增加思考预算可提升复杂推理质量，但增加延迟和 token 消耗（0 = 关闭）',
  thinkingBudgetOff: '关闭',
  thinkingDefault: '默认',
  thinkingDefaultDesc: '依赖模型默认行为',
  thinkingOff: '关闭',
  thinkingOffDesc: '禁用推理',
  thinkingLight: '浮想',
  thinkingLightDesc: '低强度推理',
  thinkingMedium: '斟酌',
  thinkingMediumDesc: '中强度推理',
  thinkingDeep: '沉思',
  thinkingDeepDesc: '高强度推理',
  groundingSources: '参考来源',

  // 图片
  imageUpload: '上传图片',
  imageMaxReached: '最多附加 4 张图片',
  imageLoadFailed: '图片加载失败',
  imageNotSupported: '当前模型可能不支持图片分析',

  // 导入导出
  exportSettings: '导出配置',
  importSettings: '导入配置',
  exportToClipboard: '复制到剪贴板',
  exportToFile: '保存为文件',
  importFromClipboard: '从剪贴板导入',
  importFromFile: '从文件导入',
  exportSuccess: '配置已导出',
  importSuccess: '配置已导入',
  importFailed: '导入失败：格式无效',
  importConfirm: '导入将覆盖当前配置，确定继续？',
} as const

export type TranslationKey = keyof typeof zh
