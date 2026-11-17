// Recorrido de capturas de todas las pantallas: `node e2e/tour.mjs <carpeta>` (revisión de la experiencia)
import { RICH, close, launch, openGame, winWithHints } from './lib.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const out = process.argv[2];
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });
const seen = { hasSeenTutorial: true, hasSeenLightsTip: true, hasSeenFlowTip: true, hasSeenStonesTip: true, hasSeenGraphicsNotice: true };
try {
  await launch();
  // Jugador nuevo: sin nada guardado
  let g = await openGame({ label: 'nuevo', out, menu: true, query: '?debug' });
  await g.shot('01-nuevo-inicio');
  await g.tap(...g.pos.homePlay, 900);
  await g.shot('02-nuevo-puzzles');
  await g.tap(...g.pos.playBack, 700);
  await g.tap(...g.pos.homeMain, 1500);
  await g.shot('03-nuevo-tutorial');
  await g.tap(...g.pos.tutorialSkip, 900);
  await g.shot('03b-nuevo-primer-nivel');
  await g.tap(...g.pos.hint, 900);
  await g.shot('03c-nuevo-pista-gratis');
  await g.close();
  // Jugador con progreso
  const seed = { player_progress: { ...RICH.player_progress, currentLevel: 6, sparks: 240, stats: { ...RICH.player_progress.stats, levelsSolved: 12, stars: 29 }, streak: { current: 3, best: 5, lastActiveDate: new Date().toLocaleDateString('en-CA') } }, user_settings: seen };
  for (const puzzle of ['circuits', 'lights', 'flow']) {
    g = await openGame({ label: puzzle, out, menu: true, query: '?debug', seed });
    await g.toPlayScreen();
    if (puzzle === 'circuits') await g.shot('04-puzzles');
    await g.enter(puzzle);
    await g.page.waitForTimeout(800);
    await g.shot(`05-juego-${puzzle}`);
    await winWithHints(g);
    await g.page.waitForTimeout(1200);
    await g.shot(`06-victoria-${puzzle}`);
    await g.close();
  }
  g = await openGame({ label: 'ajustes', out, menu: true, query: '?debug', seed });
  await g.shot('07-inicio');
  await g.openSettings(); await g.shot('08-ajustes');
  await g.close();
  g = await openGame({ label: 'aspectos', out, menu: true, query: '?debug', seed });
  await g.openSkins(); await g.shot('09-aspectos');
  await g.close();
  g = await openGame({ label: 'stats', out, menu: true, query: '?debug', seed });
  await g.tap(...g.pos.homeStats, 900); await g.shot('10-estadisticas');
  await g.close();
} finally { await close(); await server.close(); }
