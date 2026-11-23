// Capturas de Claves: `node e2e/code-look.mjs <carpeta>` (tutorial, tablero, revelado, victoria, nivel sin colores y Reto)
import { close, launch, openGame } from './lib.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const out = process.argv[2] ?? '.';
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });
const seen = { hasSeenTutorial: true, hasSeenLightsTip: true, hasSeenFlowTip: true, hasSeenStonesTip: true, hasSeenGraphicsNotice: true };

const typeGuess = async (g, digits) => {
  for (const d of digits) await g.tap(...g.pos.codeKey(d), 120);
};
const secretOf = (g) => g.page.evaluate(() => window.__game.scene.getScene('GameScene').codeLevelData.secret);

try {
  await launch();
  // Primera vez: tutorial y primer nivel (2 cifras del 1 al 4)
  let g = await openGame({ label: 'claves', out, menu: true, query: '?debug', seed: { user_settings: { ...seen } } });
  await g.toPlayScreen();
  await g.shot('c01-puzzles');
  await g.enter('code', 1500);
  await g.shot('c02-tutorial');
  await g.page.waitForTimeout(3500);
  await g.shot('c02b-tutorial-anim');
  await g.tap(360, g.dims.h / 2 + 1090 / 2 - 84, 900);
  await g.shot('c03-tutorial-2');
  await g.tap(360, g.dims.h / 2 + 1090 / 2 - 84, 900);
  await g.shot('c04-nivel-1');
  const secret = await secretOf(g);
  const wrong = secret.map((d) => (d % 4) + 1).reverse();
  await typeGuess(g, wrong);
  await g.shot('c05-escrito');
  await g.tap(...g.pos.codeKey('submit'), 350);
  await g.shot('c06-revelando');
  await g.page.waitForTimeout(2500);
  await g.shot('c07-revelado');
  await typeGuess(g, secret);
  await g.tap(...g.pos.codeKey('submit'), 2400);
  await g.shot('c08-abierta');
  await g.page.waitForTimeout(2500);
  await g.shot('c09-victoria');
  await g.close();

  // Nivel sin colores (peldaño 5: 4 cifras), con varios intentos y notas
  const progress = { seedBase: 77, currentLevel: 5, lightsLevel: 7, flowLevel: 4, codeLevel: 8, sparks: 120, stats: { levelsSolved: 20, perfectSolves: 3, dailyCompleted: 0, stars: 30, bestTimeByTier: {} }, streak: { current: 0, best: 0, lastActiveDate: null }, unlockedSkins: [] };
  const profile = { mode: 'normal', currentTier: 5, rating: 1000, gamesPlayed: 9, gamesWon: 9, consecutiveWinsWithoutStruggle: 0, consecutiveStruggles: 0, totalTimeSeconds: 0, totalTaps: 0 };
  g = await openGame({ label: 'claves-numeros', out, menu: true, query: '?debug', seed: { player_progress: progress, profile_adaptive_code: profile, user_settings: { ...seen, hasSeenCodeTip: true, puzzle: 'code' } } });
  await g.enter('code', 1500);
  await g.shot('c10-sin-colores');
  await g.page.waitForTimeout(3500);
  for (const guess of [[1, 2, 3, 4], [5, 6, 7, 8], [0, 9, 1, 5], [2, 4, 6, 8], [3, 1, 0, 7]]) {
    await typeGuess(g, guess);
    await g.tap(...g.pos.codeKey('submit'), 3200);
  }
  await g.shot('c11-varios-intentos');
  await g.tap(...g.pos.reset, 500); // Notas
  await g.tap(...g.pos.codeKey(9), 200);
  await g.tap(...g.pos.codeKey(2), 200);
  await g.tap(...g.pos.codeKey(2), 200);
  await g.shot('c12-notas');
  await g.tap(...g.pos.reset, 500);
  await g.tap(...g.pos.hint, 900);
  await g.shot('c13-pista');
  await g.close();

  // Reto: intentos limitados hasta perder
  const challenge = { ...profile, mode: 'challenge', currentTier: 5 };
  g = await openGame({ label: 'claves-reto', out, menu: true, query: '?debug', seed: { player_progress: progress, profile_adaptive: challenge, profile_adaptive_code: challenge, profile_adaptive_lights: challenge, profile_adaptive_flow: challenge, user_settings: { ...seen, hasSeenCodeTip: true, hasSeenCodeCountsTip: true, puzzle: 'code' } } });
  await g.enter('code', 1500);
  await g.page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    const max = s.codeMaxGuesses();
    const secret = s.codeLevelData.secret;
    const bad = secret.map((d) => (d + 1) % 10);
    for (let i = 0; i < max - 1; i++) s.codeRows = [...s.codeRows, { guess: bad, score: { exact: 0, misplaced: 0 } }];
    s.tapCount = max - 1;
    s.updateFlowVisuals();
  });
  await g.page.waitForTimeout(500);
  await g.shot('c14-reto-ultimo');
  const s2 = await secretOf(g);
  await typeGuess(g, s2.map((d) => (d + 2) % 10).reverse());
  await g.tap(...g.pos.codeKey('submit'), 300);
  // El reloj del juego va lento en un navegador sin pantalla: se espera a que salga la tarjeta
  for (let i = 0; i < 60; i++) {
    const open = await g.page.evaluate(() => window.__game.scene.getScene('GameScene').children.getAll().some((o) => (o.depth ?? 0) >= 100));
    if (open) break;
    await g.page.waitForTimeout(500);
  }
  await g.page.waitForTimeout(800);
  await g.shot('c15-reto-perdido');
  await g.close();
} finally {
  await close();
  await server.close();
}
