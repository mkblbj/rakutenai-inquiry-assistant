import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Form, Input, Select, Slider, Switch, Button,
  message, Collapse, InputNumber, Typography, Space, Tooltip, Tag, Dropdown, Modal,
} from 'antd'
import {
  ApiOutlined, GlobalOutlined, RobotOutlined,
  MessageOutlined, UndoOutlined, InfoCircleOutlined,
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExportOutlined, ImportOutlined, CopyOutlined, FileOutlined,
  SnippetsOutlined, FolderOpenOutlined,
} from '@ant-design/icons'
import { useSettingsStore, type SettingsState } from '@/stores/settings'
import { useI18n } from '@/utils/i18n'

const { TextArea } = Input
const { Text } = Typography

const DEFAULT_SYSTEM_PROMPT = `あなたは日本の EC サイトのカスタマーサポート担当者です。
丁寧で専門的な日本語で、お客様のお問い合わせに回答してください。`

export function SettingsPanel() {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  // 动态模型列表
  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // 获取远程模型列表
  const fetchModels = useCallback(async () => {
    if (!settings.apiKey || !settings.apiUrl) return
    setLoadingModels(true)
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_MODELS',
        payload: { apiUrl: settings.apiUrl, apiKey: settings.apiKey },
      })
      if (result?.ok && result.models) {
        setRemoteModels(result.models)
      } else {
        // 静默失败，不弹 toast，用户可以手动输入
        setRemoteModels([])
      }
    } catch {
      setRemoteModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [settings.apiUrl, settings.apiKey])

  // API URL 或 Key 变化时自动刷新模型列表
  useEffect(() => {
    if (settings.apiKey && settings.apiUrl) {
      fetchModels()
    } else {
      setRemoteModels([])
    }
  }, [settings.apiUrl, settings.apiKey, fetchModels])

  // 测试连接
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: {
          apiUrl: settings.apiUrl,
          apiKey: settings.apiKey,
          model: settings.model,
        },
      })

      if (result?.ok) {
        setTestResult('success')
        message.success(t('connectionSuccess'))
      } else {
        setTestResult('error')
        message.error(result?.error || t('connectionFailed'))
      }
    } catch {
      setTestResult('error')
      message.error(t('connectionError'))
    } finally {
      setTesting(false)
    }
  }

  // 构建模型下拉选项
  const modelOptions = remoteModels.length > 0
    ? remoteModels.map((m) => ({ value: m.id, label: m.name }))
    : getFallbackModelOptions()

  const collapseItems = [
    // ===== 界面设置 =====
    {
      key: 'interface',
      label: (
        <Space>
          <GlobalOutlined />
          <span>{t('interfaceSettings')}</span>
        </Space>
      ),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={t('language')}>
            <Select
              value={settings.language}
              onChange={settings.setLanguage}
              options={[
                { value: 'zh', label: '中文' },
                { value: 'ja', label: '日本語' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('theme')}>
            <Select
              value={settings.theme}
              onChange={settings.setTheme}
              options={[
                { value: 'system', label: t('themeSystem') },
                { value: 'light', label: t('themeLight') },
                { value: 'dark', label: t('themeDark') },
              ]}
            />
          </Form.Item>
        </Form>
      ),
    },

    // ===== AI 服务配置 =====
    {
      key: 'ai',
      label: (
        <Space>
          <RobotOutlined />
          <span>{t('aiSettings')}</span>
          {testResult === 'success' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
          {testResult === 'error' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
        </Space>
      ),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={t('apiUrl')}>
            <Input
              value={settings.apiUrl}
              onChange={(e) => settings.setApiConfig({ apiUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
            <Text type="secondary" className="text-xs mt-1 block">
              支持 OpenAI 兼容 API
            </Text>
          </Form.Item>
          <Form.Item
            label={
              <Space>
                {t('apiKey')}
                <Tooltip title="API Key 仅存储在本地浏览器，不会上传到任何服务器">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
          >
            <Input.Password
              value={settings.apiKey}
              onChange={(e) => settings.setApiConfig({ apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </Form.Item>
          <Form.Item
            label={
              <Space>
                {t('model')}
                {remoteModels.length > 0 && (
                  <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                    {remoteModels.length} models
                  </Tag>
                )}
                <Tooltip title="从 API 刷新模型列表">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined spin={loadingModels} />}
                    onClick={fetchModels}
                    disabled={!settings.apiKey || !settings.apiUrl}
                    style={{ padding: '0 4px', height: 'auto' }}
                  />
                </Tooltip>
              </Space>
            }
          >
            <Select
              value={settings.model || undefined}
              onChange={(model: string) => settings.setApiConfig({ model })}
              options={modelOptions}
              showSearch
              allowClear
              placeholder={loadingModels ? 'Loading models...' : 'gpt-4o-mini'}
              loading={loadingModels}
              notFoundContent={loadingModels ? 'Loading...' : 'No models found. Type to input manually.'}
              // 允许手动输入不在列表中的模型名
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase()) ||
                (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div className="px-2 py-1 border-t" style={{ opacity: 0.5, fontSize: 11 }}>
                    Tip: 可直接输入模型名
                  </div>
                </>
              )}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<ApiOutlined />}
              onClick={handleTestConnection}
              loading={testing}
              disabled={!settings.apiKey || !settings.apiUrl || !settings.model}
              block
            >
              {t('testConnection')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },

    // ===== 对话设置 =====
    {
      key: 'dialog',
      label: (
        <Space>
          <MessageOutlined />
          <span>{t('dialogSettings')}</span>
        </Space>
      ),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={`Temperature: ${settings.temperature}`}>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(v: number) => settings.setDialogSettings({ temperature: v })}
            />
          </Form.Item>
          <Form.Item label={t('maxTokens')}>
            <InputNumber
              min={256}
              max={128000}
              step={256}
              value={settings.maxTokens}
              onChange={(v) => settings.setDialogSettings({ maxTokens: v ?? 4096 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={t('streamOutput')}>
            <Switch
              checked={settings.streamEnabled}
              onChange={(v: boolean) => settings.setDialogSettings({ streamEnabled: v })}
            />
          </Form.Item>
        </Form>
      ),
    },

    // ===== 系统提示词 =====
    {
      key: 'prompt',
      label: (
        <Space>
          <MessageOutlined />
          <span>{t('systemPromptLabel')}</span>
        </Space>
      ),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item>
            <TextArea
              rows={6}
              value={settings.systemPrompt}
              onChange={(e) => settings.setSystemPrompt(e.target.value)}
              placeholder={DEFAULT_SYSTEM_PROMPT}
            />
            <Text type="secondary" className="text-xs mt-1 block">
              留空时使用内置默认提示词
            </Text>
          </Form.Item>
          <Form.Item>
            <Button
              icon={<UndoOutlined />}
              onClick={() => settings.setSystemPrompt('')}
              size="small"
            >
              {t('resetDefaults')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ]

  // ===== 导入导出 =====
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 提取可导出的设置字段（排除 actions 和内部状态） */
  const getExportData = () => {
    const { setLanguage, setTheme, setProvider, setApiConfig, setDialogSettings, setSystemPrompt, resetToDefaults, ...data } = settings
    // 也排除 _hasHydrated
    const { _hasHydrated, ...cleanData } = data as any
    return cleanData
  }

  /** 验证导入数据的基本结构 */
  const validateImportData = (data: any): data is Partial<SettingsState> => {
    if (!data || typeof data !== 'object') return false
    const validKeys = ['language', 'theme', 'provider', 'apiUrl', 'apiKey', 'model', 'temperature', 'maxTokens', 'streamEnabled', 'systemPrompt']
    return Object.keys(data).some((k) => validKeys.includes(k))
  }

  const applyImportData = (data: any) => {
    const { language, theme, provider, apiUrl, apiKey, model, temperature, maxTokens, streamEnabled, systemPrompt } = data
    if (language) settings.setLanguage(language)
    if (theme) settings.setTheme(theme)
    if (provider) settings.setProvider(provider)
    if (apiUrl || apiKey || model) settings.setApiConfig({ ...(apiUrl && { apiUrl }), ...(apiKey && { apiKey }), ...(model && { model }) })
    if (temperature != null || maxTokens != null || streamEnabled != null) {
      settings.setDialogSettings({
        ...(temperature != null && { temperature }),
        ...(maxTokens != null && { maxTokens }),
        ...(streamEnabled != null && { streamEnabled }),
      })
    }
    if (systemPrompt != null) settings.setSystemPrompt(systemPrompt)
  }

  // 导出到剪贴板
  const exportToClipboard = async () => {
    const json = JSON.stringify(getExportData(), null, 2)
    await navigator.clipboard.writeText(json)
    message.success(t('exportSuccess'))
  }

  // 导出为文件
  const exportToFile = () => {
    const json = JSON.stringify(getExportData(), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inquiry-ai-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('exportSuccess'))
  }

  // 从剪贴板导入
  const importFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const data = JSON.parse(text)
      if (!validateImportData(data)) {
        message.error(t('importFailed'))
        return
      }
      Modal.confirm({
        title: t('importSettings'),
        content: t('importConfirm'),
        onOk: () => {
          applyImportData(data)
          message.success(t('importSuccess'))
        },
      })
    } catch {
      message.error(t('importFailed'))
    }
  }

  // 从文件导入
  const importFromFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (!validateImportData(data)) {
          message.error(t('importFailed'))
          return
        }
        Modal.confirm({
          title: t('importSettings'),
          content: t('importConfirm'),
          onOk: () => {
            applyImportData(data)
            message.success(t('importSuccess'))
          },
        })
      } catch {
        message.error(t('importFailed'))
      }
    }
    reader.readAsText(file)
    // reset，让同一个文件也能重新触发
    e.target.value = ''
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <Collapse
        items={collapseItems}
        defaultActiveKey={['interface', 'ai']}
        ghost
        size="small"
      />

      {/* 导入导出 + 重置 */}
      <div className="mt-4 px-3 pb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Dropdown
            menu={{
              items: [
                { key: 'clipboard', icon: <CopyOutlined />, label: t('exportToClipboard'), onClick: exportToClipboard },
                { key: 'file', icon: <FileOutlined />, label: t('exportToFile'), onClick: exportToFile },
              ],
            }}
            trigger={['click']}
          >
            <Button icon={<ExportOutlined />} block>
              {t('exportSettings')}
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'clipboard', icon: <SnippetsOutlined />, label: t('importFromClipboard'), onClick: importFromClipboard },
                { key: 'file', icon: <FolderOpenOutlined />, label: t('importFromFile'), onClick: importFromFile },
              ],
            }}
            trigger={['click']}
          >
            <Button icon={<ImportOutlined />} block>
              {t('importSettings')}
            </Button>
          </Dropdown>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Button
          danger
          block
          onClick={() => {
            settings.resetToDefaults()
            setRemoteModels([])
            setTestResult(null)
            message.success(t('resetDefaults'))
          }}
        >
          {t('resetDefaults')}
        </Button>
      </div>
    </div>
  )
}

/** 无法从 API 获取时的回退模型列表 */
function getFallbackModelOptions() {
  return [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1-mini' },
    { value: 'o3-mini', label: 'o3-mini' },
  ]
}
