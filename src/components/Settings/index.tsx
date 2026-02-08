import { useState } from 'react'
import {
  Form, Input, Select, Slider, Switch, Button,
  message, Collapse, InputNumber, Typography, Space, Tooltip,
} from 'antd'
import {
  ApiOutlined, GlobalOutlined, RobotOutlined,
  MessageOutlined, UndoOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import { useSettingsStore, type Provider } from '@/stores/settings'
import { useI18n } from '@/utils/i18n'

const { TextArea } = Input
const { Text } = Typography

const DEFAULT_SYSTEM_PROMPT = `あなたは日本の EC サイトのカスタマーサポート担当者です。
丁寧で専門的な日本語で、お客様のお問い合わせに回答してください。`

export function SettingsPanel() {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const [testing, setTesting] = useState(false)

  const handleTestConnection = async () => {
    setTesting(true)
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
        message.success(t('connectionSuccess'))
      } else {
        message.error(result?.error || t('connectionFailed'))
      }
    } catch {
      message.error(t('connectionError'))
    } finally {
      setTesting(false)
    }
  }

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
        </Space>
      ),
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label={t('provider')}>
            <Select
              value={settings.provider}
              onChange={settings.setProvider}
              options={[
                { value: 'openai', label: 'OpenAI Compatible' },
                { value: 'gemini', label: 'Google Gemini' },
                { value: 'custom', label: t('customProvider') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('apiUrl')}>
            <Input
              value={settings.apiUrl}
              onChange={(e) => settings.setApiConfig({ apiUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
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
          <Form.Item label={t('model')}>
            <Select
              value={settings.model}
              onChange={(model: string) => settings.setApiConfig({ model })}
              options={getModelOptions(settings.provider)}
              showSearch
              allowClear
              placeholder="gpt-4o-mini"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<ApiOutlined />}
              onClick={handleTestConnection}
              loading={testing}
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

  return (
    <div className="h-full overflow-y-auto p-3">
      <Collapse
        items={collapseItems}
        defaultActiveKey={['interface', 'ai']}
        ghost
        size="small"
      />

      {/* 底部重置按钮 */}
      <div className="mt-4 px-3 pb-4">
        <Button
          danger
          block
          onClick={() => {
            settings.resetToDefaults()
            message.success(t('resetDefaults'))
          }}
        >
          {t('resetDefaults')}
        </Button>
      </div>
    </div>
  )
}

/** 根据 provider 返回对应的模型选项 */
function getModelOptions(provider: Provider) {
  switch (provider) {
    case 'openai':
      return [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'o1', label: 'o1' },
        { value: 'o1-mini', label: 'o1-mini' },
        { value: 'o3-mini', label: 'o3-mini' },
      ]
    case 'gemini':
      return [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      ]
    case 'custom':
      return []
    default:
      return []
  }
}
