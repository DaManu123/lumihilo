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
}
