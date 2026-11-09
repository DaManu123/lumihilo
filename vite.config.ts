import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
