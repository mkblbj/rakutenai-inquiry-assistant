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
  systemPromptLabel: '系统提示词',
  resetDefaults: '恢复默认',
} as const

export type TranslationKey = keyof typeof zh
