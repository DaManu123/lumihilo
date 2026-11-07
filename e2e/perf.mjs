// Mide cuánto trabajo de CPU cuesta dibujar cada fotograma del juego (reto diario, tablero grande).
// Es lo que hace que un teléfono de gama baja pierda fluidez: si dibujar un fotograma tarda más de ~16 ms
// no se llega a 60 fps. En el navegador de pruebas el GPU es por software, así que no se mide el tiempo
// total sino solo el trabajo de CPU del juego, que es comparable entre versiones.
// Se ejecuta con: npm run test:perf
import { SEEN_TUTORIAL, URL, check, openGame, section } from './lib.mjs';

const summarize = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return { mean: v.reduce((a, b) => a + b, 0) / v.length, p95: v[Math.floor(v.length * 0.95)], n: v.length };
};

export async function runPerf(out) {
  section('Coste de CPU por fotograma (reto diario)');
  const g = await openGame({ seed: SEEN_TUTORIAL, label: 'perf', out });
  await g.page.goto(URL + '?debug'); // expone el juego para poder medirlo
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

  const line = (label, s) => console.log(`${label.padEnd(20)} media ${s.mean.toFixed(2)} ms   p95 ${s.p95.toFixed(2)} ms   (${s.n} fotogramas)`);
  line('En reposo', idle);
  line('Girando piezas', tapping);
  await g.close();

  // Referencia: antes de pintar las casillas una sola vez costaba ~16 ms por fotograma en esta máquina
  check('en reposo, dibujar un fotograma cuesta menos de 8 ms de CPU', idle.mean < 8, `${idle.mean.toFixed(2)} ms`);
  check('girando piezas, dibujar un fotograma cuesta menos de 8 ms de CPU', tapping.mean < 8, `${tapping.mean.toFixed(2)} ms`);
}
