import { SEEN_TUTORIAL, RICH, close, launch, openGame } from './lib.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const out = process.argv[2];
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });
try {
  await launch();
  for (const skin of ['cyberpunk', 'matrix', 'solar']) for (const theme of ['dark', 'light']) {
    const g = await openGame({ width: 360, height: 720, label: skin, out, seed: { player_progress: { ...RICH.player_progress, currentLevel: 14, unlockedSkins: [skin] }, user_settings: { hasSeenTutorial: true, theme, skin } } });
    for (let i = 0; i < 6; i++) await g.tap(...g.pos.hint, 450);
    await g.page.waitForTimeout(700);
    await g.shot(`look-${skin}-${theme}`);
    await g.close();
  }
} finally { await close(); await server.close(); }
