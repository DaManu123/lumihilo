// Capturas de los gráficos altos: `node e2e/fx-look.mjs <carpeta> [aspectos separados por comas] [tema]`
import { RICH, close, launch, openGame } from './lib.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const out = process.argv[2];
const skins = (process.argv[3] ?? 'cyberpunk,matrix,oceano,solar,aurora').split(',');
const theme = process.argv[4] ?? 'dark';
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });
try {
  await launch();
  for (const skin of skins) {
    const seen = { hasSeenTutorial: true, hasSeenLightsTip: true, hasSeenFlowTip: true, hasSeenStonesTip: true, theme, skin, graphics: 'high' };
    const g = await openGame({ width: 393, height: 808, label: skin, out, menu: true, query: '?debug', seed: { player_progress: { ...RICH.player_progress, currentLevel: 14, unlockedSkins: [skin] }, user_settings: seen } });
    await g.page.waitForTimeout(1500);
    await g.shot(`fx-${skin}-${theme}-inicio`);
    await g.toPlayScreen();
    await g.shot(`fx-${skin}-${theme}-puzzles`);
    await g.enter('circuits');
    for (let i = 0; i < 5; i++) await g.tap(...g.pos.hint, 450);
    await g.page.waitForTimeout(600);
    await g.shot(`fx-${skin}-${theme}-circuitos`);
    await g.close();
  }
} finally { await close(); await server.close(); }
