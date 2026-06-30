import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import pxToViewport from 'postcss-px-to-viewport-8-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  // 相对路径：同时兼容 Web 静态托管（任意子目录）与 Capacitor 包内加载
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 移动端适配：375 设计稿，px 自动转 vw
  css: {
    postcss: {
      plugins: [
        pxToViewport({
          viewportWidth: 375,
          unitToConvert: 'px',
          unitPrecision: 5,
          propList: ['*'],
          viewportUnit: 'vw',
          fontViewportUnit: 'vw',
          selectorBlackList: [],
          minPixelValue: 1,
          mediaQuery: false,
          replace: true,
          landscape: false,
        }),
      ],
    },
  },
  server: {
    host: '0.0.0.0', // 允许手机通过局域网 IP 访问预览
    port: 5173,
  },
})
