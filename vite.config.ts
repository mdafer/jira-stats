import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [react()],
    server: {
      proxy: {
        '/jira': {
          target: env.VITE_JIRA_DOMAIN,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jira/, ''),
        },
      },
    },
  }
})
