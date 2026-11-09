import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // De dónde llegan las actualizaciones: 'github' (por defecto) o 'play' (UPDATE_SOURCE=play al compilar)
    __UPDATE_SOURCE__: JSON.stringify(process.env.UPDATE_SOURCE === 'play' ? 'play' : 'github'),
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
