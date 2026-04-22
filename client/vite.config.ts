import federation from '@originjs/vite-plugin-federation'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import pkg from '../package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const moduleName = pkg.name.replace('@lifeforge/', '')

const apiHost =
  process.env.DOCKER_BUILD === 'true' ? '/api' : process.env.VITE_API_HOST

export default defineConfig({
  envDir: path.resolve(__dirname, '../../../env'),
  define: {
    __PAPER_LIBRARY_API_HOST__: JSON.stringify(apiHost)
  },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: moduleName,
      filename: 'remoteEntry.js',
      exposes: {
        './Manifest': './manifest.ts'
      },
      shared: {
        react: { generate: false },
        'react-dom': { generate: false },
        shared: { generate: false },
        'lifeforge-ui': { generate: false },
        'react-i18next': { generate: false },
        i18next: { generate: false },
        '@tanstack/react-query': { generate: false }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, '../server')
    }
  },
  base: `${apiHost}/modules/${moduleName}/`,
  build: {
    outDir: process.env.DOCKER_BUILD === 'true' ? 'dist-docker' : 'dist',
    target: 'esnext',
    minify: true,
    modulePreload: false
  }
})
