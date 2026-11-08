// Genera las capturas de la ficha de Google Play (1080×2160, relación 2:1) a partir del juego real.
// Uso (desde la raíz): node e2e/store.mjs [carpeta de salida]   (por defecto docs/store/capturas)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEEN_TUTORIAL, RICH, close, launch, openGame } from './lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs/store/capturas'));
mkdirSync(out, { recursive: true });
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });

const progress = (level, theme = 'dark') => ({
  player_progress: { ...RICH.player_progress, currentLevel: level, sparks: 240 },
  user_settings: { ...SEEN_TUTORIAL.user_settings, theme },
});

try {
  await launch();
  const open = (seed, label) => openGame({ width: 360, height: 720, seed, label, out });

  let g = await open(progress(14), 'tablero');
  await g.tap(...g.pos.hint, 500); await g.tap(...g.pos.hint, 500); await g.tap(...g.pos.hint, 500);
  await g.page.waitForTimeout(900);
  await g.shot('01-tablero'); await g.close();

  g = await open(progress(8), 'victoria');
  for (let i = 0; i < 80; i++) {
    await g.tap(...g.pos.hint, 450);
    if ((await g.state()).progress.stats.levelsSolved > 0) break;
  }
  await g.page.waitForTimeout(1800);
  await g.shot('03-victoria'); await g.close();

  g = await open(progress(5), 'reto');
  await g.tap(...g.pos.daily, 900);
  for (let i = 0; i < 8; i++) await g.tap(...g.pos.hint, 450);
  await g.page.waitForTimeout(800);
  await g.shot('02-reto-diario'); await g.close();

  g = await open(progress(22, 'light'), 'claro');
  await g.tap(...g.pos.daily, 900);
  for (let i = 0; i < 7; i++) await g.tap(...g.pos.hint, 450);
  await g.page.waitForTimeout(800);
  await g.shot('04-tema-claro'); await g.close();
} finally {
  await close();
  await server.close();
}
