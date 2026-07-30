import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const HOT_FILE = path.resolve(__dirname, 'public/build/.vite-dev')

function hotFilePlugin(): Plugin {
  const cleanup = () => {
    try { fs.unlinkSync(HOT_FILE) } catch { /* ignore */ }
  }
  return {
    name: 'symfony-hot-file',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(path.dirname(HOT_FILE), { recursive: true })
      const url = `http://${server.config.server.host || '127.0.0.1'}:${server.config.server.port || 5173}`
      fs.writeFileSync(HOT_FILE, url, 'utf-8')
      process.on('exit', cleanup)
      process.on('SIGINT', () => { cleanup(); process.exit() })
      process.on('SIGTERM', () => { cleanup(); process.exit() })
      process.on('SIGHUP', () => { cleanup(); process.exit() })
    },
    closeBundle: cleanup,
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), hotFilePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'assets'),
    },
  },
  root: '.',
  base: '/build/',
  publicDir: false,
  build: {
    manifest: true,
    outDir: 'public/build',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: 'assets/main.tsx',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    cors: true,
  },
})
