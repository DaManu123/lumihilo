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

const lightsProgress = (level, theme = 'dark', skin = 'filamento', tier = 6) => {
  const p = progress(1, theme, skin);
  p.player_progress.lightsLevel = level;
  p.user_settings = { ...p.user_settings, puzzle: 'lights', hasSeenLightsTip: true, hasSeenStonesTip: true };
  p.profile_adaptive = { currentTier: tier };
  return p;
};

const flowProgress = (level, theme = 'dark', skin = 'filamento', tier = 6) => {
  const p = progress(1, theme, skin);
  p.player_progress.flowLevel = level;
  p.user_settings = { ...p.user_settings, puzzle: 'flow', hasSeenFlowTip: true };
  p.profile_adaptive = { currentTier: tier };
  return p;
};

const progress = (level, theme = 'dark', skin = 'filamento') => ({
  player_progress: { ...RICH.player_progress, currentLevel: level, sparks: 240, unlockedSkins: skin === 'filamento' ? [] : [skin] },
  user_settings: { ...SEEN_TUTORIAL.user_settings, theme, skin },
});

try {
  await launch();
  const open = (seed, label) => openGame({ width: 360, height: 720, seed, label, out, scale: 2 });

  let g = await open(progress(14), 'tablero');
  await g.tap(...g.pos.hint, 500); await g.tap(...g.pos.hint, 500); await g.tap(...g.pos.hint, 500);
  await g.page.waitForTimeout(900);
  await g.shot('01-tablero'); await g.close();

  // Victoria real: se resuelve girando cada pieza lo justo (sin pistas), por el camino más corto
  g = await open(progress(8), 'victoria');
  await g.page.goto('http://localhost:4173/?debug');
  await g.page.waitForSelector('canvas');
  await g.page.waitForTimeout(1500);
  const taps = await g.page.evaluate(async () => {
    const scene = window.__game.scene.scenes.find((sc) => sc.handleCellTap);
    const level = scene.currentLevelData;
    let n = 0;
    for (let r = 0; r < scene.board.rows; r++) {
      for (let c = 0; c < scene.board.cols; c++) {
        const need = (level.solutionRotations[r][c] - scene.board.grid[r][c].rotation + 4) % 4;
        const view = scene.cellViews[r][c];
        const times = need === 3 ? 1 : need;
        for (let i = 0; i < times; i++) {
          while (view.isRotating) await new Promise((res) => setTimeout(res, 30));
          scene.handleCellTap(view, need === 3);
          n++;
          await new Promise((res) => setTimeout(res, 330));
        }
      }
    }
    return n;
  });
  console.log('Toques para la captura de victoria:', taps);
  await g.page.waitForTimeout(2200);
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
  g = await open(progress(14, 'dark', 'oceano'), 'oceano');
  for (let i = 0; i < 6; i++) await g.tap(...g.pos.hint, 450);
  await g.page.waitForTimeout(900);
  await g.shot('05-oceano'); await g.close();

  g = await open(progress(14, 'dark', 'cyberpunk'), 'cyberpunk');
  for (let i = 0; i < 6; i++) await g.tap(...g.pos.hint, 450);
  await g.page.waitForTimeout(900);
  await g.shot('06-cyberpunk'); await g.close();

  g = await open(progress(14, 'dark', 'oceano'), 'tienda');
  await g.openSkins(700);
  await g.shot('07-aspectos'); await g.close();

  g = await open(progress(14, 'dark', 'aurora'), 'aurora');
  for (let i = 0; i < 6; i++) await g.tap(...g.pos.hint, 450);
  await g.page.waitForTimeout(900);
  await g.shot('10-aurora'); await g.close();

  g = await open(lightsProgress(45, 'dark', 'filamento', 6), 'luces');
  for (let i = 0; i < 2; i++) await g.tap(...g.pos.hint, 500);
  await g.page.waitForTimeout(900);
  await g.shot('08-luces'); await g.close();

  g = await open(lightsProgress(30, 'dark', 'oceano', 4), 'luces-oceano');
  for (let i = 0; i < 3; i++) await g.tap(...g.pos.hint, 500);
  await g.page.waitForTimeout(900);
  await g.shot('09-luces-oceano'); await g.close();

  g = await open(flowProgress(40, 'dark', 'filamento', 6), 'hilos');
  for (let i = 0; i < 2; i++) await g.tap(...g.pos.hint, 600);
  await g.page.waitForTimeout(900);
  await g.shot('11-hilos'); await g.close();

  g = await open(flowProgress(25, 'dark', 'oceano', 4), 'hilos-oceano');
  for (let i = 0; i < 3; i++) await g.tap(...g.pos.hint, 600);
  await g.page.waitForTimeout(900);
  await g.shot('12-hilos-oceano'); await g.close();

  // Victoria real: se arrastra cada hilo por su solución (sin pistas)
  g = await openGame({ width: 360, height: 720, scale: 2, seed: flowProgress(12, 'dark', 'filamento', 3), label: 'hilos-victoria', out, query: '?debug' });
  const sols = await g.page.evaluate(() => {
    const sc = window.__game.scene.scenes.find((x) => x.flowLevelData);
    return sc.flowLevelData.solution.map((p) => p.map((c) => [sc.cellViews[c.row][c.col].container.x, sc.cellViews[c.row][c.col].container.y]));
  });
  for (const path of sols) await g.drag(path, 200);
  await g.page.waitForTimeout(3000);
  await g.shot('13-hilos-victoria'); await g.close();
} finally {
  await close();
  await server.close();
}
