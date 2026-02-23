import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Form, Input, Select, Slider, Switch, Button, Segmented,
  message, Collapse, InputNumber, Typography, Space, Tooltip, Tag, Dropdown, Modal,
} from 'antd'
import {
  ApiOutlined, GlobalOutlined, RobotOutlined,
  MessageOutlined, UndoOutlined, InfoCircleOutlined,
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExportOutlined, ImportOutlined, CopyOutlined, FileOutlined,
  SnippetsOutlined, FolderOpenOutlined,
} from '@ant-design/icons'
import { useSettingsStore, type SettingsState, type ShopProfile } from '@/stores/settings'
import { useI18n } from '@/utils/i18n'
import { DEFAULT_COPILOT_SKELETON } from '@/utils/build-system-prompt'

const { TextArea } = Input
const { Text } = Typography

const SYSTEM_PROMPT_PLACEHOLDER = `例: 必ず敬語を使用してください。回答は3文以内に。`

export function SettingsPanel() {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [geminiRemoteModels, setGeminiRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false)

  const isGemini = settings.provider === 'gemini'

  // 获取 OpenAI 模型列表
  const fetchModels = useCallback(async () => {
    if (isGemini || !settings.apiKey || !settings.apiUrl) return
    setLoadingModels(true)
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_MODELS',
        payload: { apiUrl: settings.apiUrl, apiKey: settings.apiKey },
      })
      if (result?.ok && result.models) {
        setRemoteModels(result.models)
      } else {
        setRemoteModels([])
      }
    } catch {
      setRemoteModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [settings.apiUrl, settings.apiKey, isGemini])

  // 获取 Gemini 模型列表（仅手动触发）
  const fetchGeminiModels = useCallback(async () => {
    if (!settings.geminiApiKey) return
    setLoadingGeminiModels(true)
    try {
      const base = normalizeGeminiBase(settings.geminiBaseUrl)
      const resp = await fetch(`${base}/models`, {
        headers: geminiHeaders(settings.geminiApiKey),
      })
      if (!resp.ok) {
        message.warning(`模型列表获取失败 (${resp.status})，可直接输入模型名`)
        setGeminiRemoteModels([])
        return
      }
      const data = await resp.json()
      if (data.models && Array.isArray(data.models)) {
        const models = data.models
          .filter((m: any) => m.name?.startsWith('models/'))
          .map((m: any) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', ''),
          }))
          .filter((m: { id: string }) => /gemini/i.test(m.id))
        setGeminiRemoteModels(models)
        if (models.length > 0) message.success(`已获取 ${models.length} 个模型`)
      } else {
        setGeminiRemoteModels([])
      }
    } catch {
      message.warning('模型列表获取失败，可直接输入模型名')
      setGeminiRemoteModels([])
    } finally {
      setLoadingGeminiModels(false)
    }
  }, [settings.geminiBaseUrl, settings.geminiApiKey])

  useEffect(() => {
    if (!isGemini && settings.apiKey && settings.apiUrl) {
      fetchModels()
    } else {
      setRemoteModels([])
    }
  }, [settings.apiUrl, settings.apiKey, isGemini, fetchModels])

  // 测试连接
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (isGemini) {
        const model = settings.geminiModel || 'gemini-2.5-flash'
        const base = normalizeGeminiBase(settings.geminiBaseUrl)
        const url = `${base}/models/${model}:generateContent`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { ...geminiHeaders(settings.geminiApiKey), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        })
        const data = await resp.json()
        if (data.candidates?.[0]?.content) {
          setTestResult('success')
          message.success(t('connectionSuccess'))
        } else {
          setTestResult('error')
          message.error(data.error?.message || t('connectionFailed'))
        }
      } else {
        const result = await chrome.runtime.sendMessage({
          type: 'TEST_CONNECTION',
          payload: { apiUrl: settings.apiUrl, apiKey: settings.apiKey, model: settings.model },
        })
        if (result?.ok) {
          setTestResult('success')
          message.success(t('connectionSuccess'))
        } else {
          setTestResult('error')
          message.error(result?.error || t('connectionFailed'))
        }
      }
    } catch {
      setTestResult('error')
      message.error(t('connectionError'))
    } finally {
      setTesting(false)
    }
  }

  const modelOptions = remoteModels.length > 0
    ? remoteModels.map((m) => ({ value: m.id, label: m.name }))
    : getFallbackModelOptions()

  // ===== OpenAI 配置表单 =====
  const openaiFields = (
    <>
      <Form.Item label={t('apiUrl')}>
        <Input
          value={settings.apiUrl}
          onChange={(e) => settings.setApiConfig({ apiUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
        <Text type="secondary" className="text-xs mt-1 block">支持 OpenAI 兼容 API</Text>
      </Form.Item>
      <Form.Item
        label={<Space>{t('apiKey')}<Tooltip title="API Key 仅存储在本地浏览器，不会上传到任何服务器"><InfoCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>}
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
              <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{remoteModels.length} models</Tag>
            )}
            <Tooltip title="从 API 刷新模型列表">
              <Button type="text" size="small" icon={<ReloadOutlined spin={loadingModels} />} onClick={fetchModels} disabled={!settings.apiKey || !settings.apiUrl} style={{ padding: '0 4px', height: 'auto' }} />
            </Tooltip>
          </Space>
        }
      >
        <Select
          value={settings.model || undefined}
          onChange={(model: string) => settings.setApiConfig({ model })}
          options={modelOptions}
          showSearch allowClear
          placeholder={loadingModels ? 'Loading models...' : 'gpt-4o-mini'}
          loading={loadingModels}
          notFoundContent={loadingModels ? 'Loading...' : 'No models found. Type to input manually.'}
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase()) ||
            (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          dropdownRender={(menu) => (<>{menu}<div className="px-2 py-1 border-t" style={{ opacity: 0.5, fontSize: 11 }}>Tip: 可直接输入模型名</div></>)}
        />
      </Form.Item>
    </>
  )

  // ===== Gemini 配置表单 =====
  const geminiFields = (
    <>
      <Form.Item label={t('apiUrl')}>
        <Input
          value={settings.geminiBaseUrl}
          onChange={(e) => settings.setGeminiConfig({ geminiBaseUrl: e.target.value })}
          placeholder="https://generativelanguage.googleapis.com/v1beta"
        />
        <Text type="secondary" className="text-xs mt-1 block">留空使用官方地址</Text>
      </Form.Item>
      <Form.Item
        label={<Space>{t('apiKey')}<Tooltip title="API Key 仅存储在本地浏览器，不会上传到任何服务器"><InfoCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>}
      >
        <Input.Password
          value={settings.geminiApiKey}
          onChange={(e) => settings.setGeminiConfig({ geminiApiKey: e.target.value })}
          placeholder="AIzaSy..."
        />
      </Form.Item>
      <Form.Item
        label={
          <Space>
            {t('model')}
            {geminiRemoteModels.length > 0 && (
              <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{geminiRemoteModels.length} models</Tag>
            )}
            <Tooltip title="从 Gemini API 刷新模型列表">
              <Button type="text" size="small" icon={<ReloadOutlined spin={loadingGeminiModels} />} onClick={fetchGeminiModels} disabled={!settings.geminiApiKey} style={{ padding: '0 4px', height: 'auto' }} />
            </Tooltip>
          </Space>
        }
      >
        <Select
          value={settings.geminiModel || undefined}
          onChange={(model: string) => settings.setGeminiConfig({ geminiModel: model })}
          options={buildGeminiModelOptions(settings.geminiModel, geminiRemoteModels)}
          showSearch allowClear
          placeholder={loadingGeminiModels ? 'Loading models...' : 'gemini-2.5-flash'}
          loading={loadingGeminiModels}
          notFoundContent={loadingGeminiModels ? 'Loading...' : 'Type to input manually.'}
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase()) ||
            (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          dropdownRender={(menu) => (<>{menu}<div className="px-2 py-1 border-t" style={{ opacity: 0.5, fontSize: 11 }}>Tip: 可直接输入模型名</div></>)}
        />
      </Form.Item>
    </>
  )

  const collapseItems = [
    // ===== 界面设置 =====
    {
      key: 'interface',
      label: (<Space><GlobalOutlined /><span>{t('interfaceSettings')}</span></Space>),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={t('language')}>
            <Select value={settings.language} onChange={settings.setLanguage} options={[{ value: 'zh', label: '中文' }, { value: 'ja', label: '日本語' }, { value: 'en', label: 'English' }]} />
          </Form.Item>
          <Form.Item label={t('theme')}>
            <Select value={settings.theme} onChange={settings.setTheme} options={[{ value: 'system', label: t('themeSystem') }, { value: 'light', label: t('themeLight') }, { value: 'dark', label: t('themeDark') }]} />
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
          <Form.Item label={t('providerLabel')}>
            <Segmented
              value={settings.provider === 'gemini' ? 'gemini' : 'openai'}
              onChange={(val) => { settings.setProvider(val as any); setTestResult(null); setRemoteModels([]) }}
              options={[{ value: 'openai', label: t('providerOpenai') }, { value: 'gemini', label: t('providerGemini') }]}
              block
            />
          </Form.Item>

          {isGemini ? geminiFields : openaiFields}

          <Form.Item>
            <Button
              type="primary"
              icon={<ApiOutlined />}
              onClick={handleTestConnection}
              loading={testing}
              disabled={isGemini ? !settings.geminiApiKey : (!settings.apiKey || !settings.apiUrl)}
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
      label: (<Space><MessageOutlined /><span>{t('dialogSettings')}</span></Space>),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={`Temperature: ${settings.temperature}`}>
            <Slider min={0} max={2} step={0.1} value={settings.temperature} onChange={(v: number) => settings.setDialogSettings({ temperature: v })} />
          </Form.Item>
          <Form.Item label={t('maxTokens')}>
            <InputNumber min={256} max={128000} step={256} value={settings.maxTokens} onChange={(v) => settings.setDialogSettings({ maxTokens: v ?? 4096 })} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('streamOutput')}>
            <Switch checked={settings.streamEnabled} onChange={(v: boolean) => settings.setDialogSettings({ streamEnabled: v })} />
          </Form.Item>
        </Form>
      ),
    },

    // ===== Copilot 核心提示词 =====
    {
      key: 'copilot',
      label: (<Space><RobotOutlined /><span>{t('copilotPromptLabel')}</span></Space>),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item>
            <TextArea rows={12} value={settings.copilotPrompt || DEFAULT_COPILOT_SKELETON} onChange={(e) => settings.setCopilotPrompt(e.target.value)} />
            <Text type="secondary" className="text-xs mt-1 block">{t('copilotPromptHint')}</Text>
          </Form.Item>
          <Form.Item>
            <Button icon={<UndoOutlined />} onClick={() => settings.setCopilotPrompt('')} size="small">{t('resetDefaults')}</Button>
          </Form.Item>
        </Form>
      ),
    },

    // ===== 追加规则 =====
    {
      key: 'prompt',
      label: (<Space><MessageOutlined /><span>{t('systemPromptLabel')}</span></Space>),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item>
            <TextArea rows={6} value={settings.systemPrompt} onChange={(e) => settings.setSystemPrompt(e.target.value)} placeholder={SYSTEM_PROMPT_PLACEHOLDER} />
            <Text type="secondary" className="text-xs mt-1 block">{t('systemPromptHint')}</Text>
          </Form.Item>
          <Form.Item>
            <Button icon={<UndoOutlined />} onClick={() => settings.setSystemPrompt('')} size="small">{t('resetDefaults')}</Button>
          </Form.Item>
        </Form>
      ),
    },

    // ===== 店铺规则 =====
    {
      key: 'shopProfile',
      label: (<Space><FileOutlined /><span>{t('shopProfileLabel')}</span></Space>),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={t('shopName')}>
            <Input value={settings.shopProfile?.shopName ?? ''} onChange={(e) => settings.setShopProfile({ shopName: e.target.value })} placeholder="例: 楽天ショップA" />
          </Form.Item>
          <Form.Item label={t('cancelPolicy')}>
            <TextArea rows={3} value={settings.shopProfile?.cancelPolicy ?? ''} onChange={(e) => settings.setShopProfile({ cancelPolicy: e.target.value })} placeholder="例: 未発送の場合はキャンセル可。発送済みの場合は受取拒否または返品対応。" />
          </Form.Item>
          <Form.Item label={t('returnPolicy')}>
            <TextArea rows={3} value={settings.shopProfile?.returnPolicy ?? ''} onChange={(e) => settings.setShopProfile({ returnPolicy: e.target.value })} placeholder="例: 商品到着後7日以内。お客様都合の場合は送料お客様負担。" />
          </Form.Item>
          <Form.Item label={t('exchangePolicy')}>
            <TextArea rows={3} value={settings.shopProfile?.exchangePolicy ?? ''} onChange={(e) => settings.setShopProfile({ exchangePolicy: e.target.value })} placeholder="例: 不良品の場合のみ交換可。着払いにて返送後、新品を再発送。" />
          </Form.Item>
          <Form.Item label={t('shippingPolicy')}>
            <TextArea rows={3} value={settings.shopProfile?.shippingPolicy ?? ''} onChange={(e) => settings.setShopProfile({ shippingPolicy: e.target.value })} placeholder="例: 送料無料条件、再発送時の送料負担ルール等" />
          </Form.Item>
          <Form.Item label={t('processNotes')}>
            <TextArea rows={4} value={settings.shopProfile?.processNotes ?? ''} onChange={(e) => settings.setShopProfile({ processNotes: e.target.value })} placeholder="例: 返送先住所、返品手順、注意事項等" />
          </Form.Item>
          <Form.Item label={t('signature')}>
            <TextArea rows={2} value={settings.shopProfile?.signature ?? ''} onChange={(e) => settings.setShopProfile({ signature: e.target.value })} placeholder="例: 何かご不明な点がございましたら、お気軽にお問い合わせください。" />
          </Form.Item>
          <Text type="secondary" className="text-xs">{t('shopProfileHint')}</Text>
        </Form>
      ),
    },
  ]

  // ===== 导入导出 =====
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getExportData = () => {
    const { setLanguage, setTheme, setProvider, setApiConfig, setGeminiConfig, setDialogSettings, setSystemPrompt, resetToDefaults, ...data } = settings
    const { _hasHydrated, ...cleanData } = data as any
    return cleanData
  }

  const validateImportData = (data: any): data is Partial<SettingsState> => {
    if (!data || typeof data !== 'object') return false
    const validKeys = ['language', 'theme', 'provider', 'apiUrl', 'apiKey', 'model', 'geminiBaseUrl', 'geminiApiKey', 'geminiModel', 'temperature', 'maxTokens', 'streamEnabled', 'webSearchEnabled', 'thinkingBudget', 'copilotPrompt', 'systemPrompt', 'shopProfile']
    return Object.keys(data).some((k) => validKeys.includes(k))
  }

  const applyImportData = (data: any) => {
    const { language, theme, provider, apiUrl, apiKey, model, temperature, maxTokens, streamEnabled, systemPrompt } = data
    if (language) settings.setLanguage(language)
    if (theme) settings.setTheme(theme)
    if (provider) settings.setProvider(provider)
    if (apiUrl || apiKey || model) settings.setApiConfig({ ...(apiUrl && { apiUrl }), ...(apiKey && { apiKey }), ...(model && { model }) })
    if (data.geminiBaseUrl || data.geminiApiKey || data.geminiModel) {
      settings.setGeminiConfig({
        ...(data.geminiBaseUrl && { geminiBaseUrl: data.geminiBaseUrl }),
        ...(data.geminiApiKey && { geminiApiKey: data.geminiApiKey }),
        ...(data.geminiModel && { geminiModel: data.geminiModel }),
      })
    }
    if (temperature != null || maxTokens != null || streamEnabled != null) {
      settings.setDialogSettings({ ...(temperature != null && { temperature }), ...(maxTokens != null && { maxTokens }), ...(streamEnabled != null && { streamEnabled }) })
    }
    if (data.webSearchEnabled != null) settings.setWebSearchEnabled(data.webSearchEnabled)
    if (data.thinkingBudget != null) settings.setThinkingBudget(data.thinkingBudget)
    if (data.copilotPrompt != null) settings.setCopilotPrompt(data.copilotPrompt)
    if (systemPrompt != null) settings.setSystemPrompt(systemPrompt)
    if (data.shopProfile) settings.setShopProfile(data.shopProfile)
  }

  const exportToClipboard = async () => { await navigator.clipboard.writeText(JSON.stringify(getExportData(), null, 2)); message.success(t('exportSuccess')) }
  const exportToFile = () => {
    const json = JSON.stringify(getExportData(), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `inquiry-ai-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url); message.success(t('exportSuccess'))
  }
  const importFromClipboard = async () => {
    try {
      const data = JSON.parse(await navigator.clipboard.readText())
      if (!validateImportData(data)) { message.error(t('importFailed')); return }
      Modal.confirm({ title: t('importSettings'), content: t('importConfirm'), onOk: () => { applyImportData(data); message.success(t('importSuccess')) } })
    } catch { message.error(t('importFailed')) }
  }
  const importFromFile = () => { fileInputRef.current?.click() }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (!validateImportData(data)) { message.error(t('importFailed')); return }
        Modal.confirm({ title: t('importSettings'), content: t('importConfirm'), onOk: () => { applyImportData(data); message.success(t('importSuccess')) } })
      } catch { message.error(t('importFailed')) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <Collapse items={collapseItems} defaultActiveKey={['interface', 'ai']} ghost size="small" />
      <div className="mt-4 px-3 pb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Dropdown menu={{ items: [{ key: 'clipboard', icon: <CopyOutlined />, label: t('exportToClipboard'), onClick: exportToClipboard }, { key: 'file', icon: <FileOutlined />, label: t('exportToFile'), onClick: exportToFile }] }} trigger={['click']}>
            <Button icon={<ExportOutlined />} block>{t('exportSettings')}</Button>
          </Dropdown>
          <Dropdown menu={{ items: [{ key: 'clipboard', icon: <SnippetsOutlined />, label: t('importFromClipboard'), onClick: importFromClipboard }, { key: 'file', icon: <FolderOpenOutlined />, label: t('importFromFile'), onClick: importFromFile }] }} trigger={['click']}>
            <Button icon={<ImportOutlined />} block>{t('importSettings')}</Button>
          </Dropdown>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
        <Button danger block onClick={() => { settings.resetToDefaults(); setRemoteModels([]); setTestResult(null); message.success(t('resetDefaults')) }}>{t('resetDefaults')}</Button>
      </div>
    </div>
  )
}

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

function buildGeminiModelOptions(
  currentModel: string | undefined,
  remoteModels: Array<{ id: string; name: string }>,
) {
  const base = remoteModels.length > 0
    ? remoteModels.map((m) => ({ value: m.id, label: m.name }))
    : getGeminiFallbackOptions()
  if (currentModel && !base.some((o) => o.value === currentModel)) {
    base.unshift({ value: currentModel, label: currentModel })
  }
  return base
}

function getGeminiFallbackOptions() {
  return [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ]
}

function geminiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'x-goog-api-key': apiKey,
  }
}

/** Normalize user input to a proper Gemini API base URL */
function normalizeGeminiBase(input?: string): string {
  const DEFAULT = 'https://generativelanguage.googleapis.com/v1beta'
  if (!input?.trim()) return DEFAULT
  let url = input.trim().replace(/\/+$/, '')
  // If user entered just the host without /v1beta, append it
  if (!url.match(/\/v\d/)) {
    url += '/v1beta'
  }
  return url
}
