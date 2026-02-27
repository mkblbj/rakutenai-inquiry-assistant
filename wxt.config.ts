import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // headless Linux 环境：禁用自动启动浏览器，手动加载 .output/chrome-mv3-dev/
  webExt: {
    disabled: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['@ant-design/x-markdown/plugins/Latex', 'marked-alert'],
    },
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'ja',
    permissions: ['storage', 'unlimitedStorage', 'tabs', 'permissions'],
    host_permissions: [
      'https://*.rakuten.co.jp/*',
      'https://*.mercari.com/*',
      'https://*.amazon.co.jp/*',
    ],
    optional_host_permissions: [
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.zenmux.ai/*',
    ],
    action: {
      default_title: 'Open AI Assistant',
    },
  },
})
