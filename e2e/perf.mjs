// Mide cuánto trabajo de CPU cuesta dibujar cada fotograma del juego (reto diario, tablero grande).
// Es lo que hace que un teléfono de gama baja pierda fluidez: si dibujar un fotograma tarda más de ~16 ms
// no se llega a 60 fps. En el navegador de pruebas el GPU es por software, así que no se mide el tiempo
// total sino solo el trabajo de CPU del juego, que es comparable entre versiones.
// Se ejecuta con: npm run test:perf
import { SEEN_TUTORIAL, check, openGame, section } from './lib.mjs';

const summarize = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return { mean: v.reduce((a, b) => a + b, 0) / v.length, p95: v[Math.floor(v.length * 0.95)], n: v.length };
};

async function measure(out, label, seed) {
  // `?debug` expone el juego para poder medirlo; openGame entra al puzzle desde el menú
  const g = await openGame({ seed, label, out, query: '?debug' });
  await g.page.waitForTimeout(1500);
  await g.tap(...g.pos.daily, 900);

  await g.page.evaluate(() => {
    const r = window.__game.renderer;
    const render = r.render.bind(r);
    window.__cpu = [];
    r.render = (...args) => { const t = performance.now(); render(...args); window.__cpu.push(performance.now() - t); };
  });
  const read = async () => summarize(await g.page.evaluate(() => { const v = window.__cpu.slice(); window.__cpu.length = 0; return v; }));

  await read();
  await g.page.waitForTimeout(2500);
  const idle = await read();

  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < 2500; i++) await g.tap(80 + ((i * 137) % 560), 640 + ((i * 211) % 500), 40);
  const tapping = await read();

  const line = (name, s) => console.log(`${(label + ' · ' + name).padEnd(34)} media ${s.mean.toFixed(2)} ms   p95 ${s.p95.toFixed(2)} ms   (${s.n} fotogramas)`);
  line('en reposo', idle);
  line('girando piezas', tapping);
  await g.close();
  return { idle, tapping };
}

/** Claves con el nivel más grande (6 cifras) y la lista de intentos llena: todo son Graphics, hay que vigilarlo. */
async function measureCode(out) {
  const profile = { mode: 'normal', currentTier: 10, rating: 1000, gamesPlayed: 0, gamesWon: 0, consecutiveWinsWithoutStruggle: 0, consecutiveStruggles: 0, totalTimeSeconds: 0, totalTaps: 0 };
  const g = await openGame({
    label: 'perf-claves',
    out,
    query: '?debug',
    seed: { user_settings: { hasSeenTutorial: true, hasSeenCodeTip: true, hasSeenCodeCountsTip: true, puzzle: 'code' }, player_progress: { seedBase: 99, codeLevel: 9, sparks: 0 }, profile_adaptive_code: profile },
  });
  await g.page.waitForTimeout(1500);
  await g.page.evaluate(() => {
    const sc = window.__game.scene.getScene('GameScene');
    const guess = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < 14; i++) sc.codeRows = [...sc.codeRows, { guess, score: { exact: i % 3, misplaced: i % 4 } }];
    sc.buildBoard();
    const r = window.__game.renderer;
    const render = r.render.bind(r);
    window.__cpu = [];
    r.render = (...args) => { const t = performance.now(); render(...args); window.__cpu.push(performance.now() - t); };
  });
  await g.page.waitForTimeout(500);
  await g.page.evaluate(() => (window.__cpu.length = 0));
  await g.page.waitForTimeout(2500);
  const idle = summarize(await g.page.evaluate(() => window.__cpu.slice()));
  console.log(`${'Claves (6 cifras, 14 intentos) · en reposo'.padEnd(34)} media ${idle.mean.toFixed(2)} ms   p95 ${idle.p95.toFixed(2)} ms   (${idle.n} fotogramas)`);
  await g.close();
  return idle;
}

export async function runPerf(out) {
  section('Coste de CPU por fotograma (reto diario)');
  const normal = await measure(out, 'Gráficos normales', SEEN_TUTORIAL);
  // Referencia: antes de pintar las casillas una sola vez costaba ~16 ms por fotograma en esta máquina
  check('en reposo, dibujar un fotograma cuesta menos de 8 ms de CPU', normal.idle.mean < 8, `${normal.idle.mean.toFixed(2)} ms`);
  check('girando piezas, dibujar un fotograma cuesta menos de 8 ms de CPU', normal.tapping.mean < 8, `${normal.tapping.mean.toFixed(2)} ms`);

  // Gráficos altos con el aspecto más cargado de partículas: gastan más, pero deben seguir por debajo de un fotograma a 60 fps
  const high = await measure(out, 'Gráficos altos (Aurora)', {
    user_settings: { hasSeenTutorial: true, graphics: 'high', skin: 'aurora' },
    player_progress: { seedBase: 1234, currentLevel: 1, sparks: 0, unlockedSkins: ['aurora'] },
  });
  check('con gráficos altos, en reposo, un fotograma cuesta menos de 14 ms de CPU', high.idle.mean < 14, `${high.idle.mean.toFixed(2)} ms`);
  check('con gráficos altos, girando piezas, un fotograma cuesta menos de 14 ms de CPU', high.tapping.mean < 14, `${high.tapping.mean.toFixed(2)} ms`);

  const code = await measureCode(out);
  check('Claves con la lista llena: un fotograma cuesta menos de 8 ms de CPU', code.mean < 8, `${code.mean.toFixed(2)} ms`);
}
