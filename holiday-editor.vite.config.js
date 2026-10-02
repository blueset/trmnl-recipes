import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = fileURLToPath(new URL('.github.pages/holiday-editor/', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'iconify-icon' } } })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    outDir: resolve(root, '../../dist/holiday-editor'),
    emptyOutDir: true,
    rolldownOptions: { input: { editor: resolve(root, 'index.html'), callback: resolve(root, 'callback.html') } },
  },
});
