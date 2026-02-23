import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load all env vars (not just VITE_-prefixed) so BACKEND_URL is available
  // for the dev proxy.  BACKEND_URL is never baked into the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.BACKEND_URL ?? 'http://localhost:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
