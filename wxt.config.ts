import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'ja',
    permissions: ['storage', 'tabs', 'permissions'],
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
