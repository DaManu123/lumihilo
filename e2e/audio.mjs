// Medición del volumen real de la música y los efectos (sin oídos): intercepta lo que llega a la salida de
// audio y calcula el pico y el volumen medio en dBFS. Sirve para comprobar la mezcla y que el volumen ajustable
// sube y baja de verdad sin distorsionar.
import { check, openGame, section } from './lib.mjs';

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(1).padStart(6) : '  -inf');

/** Mide durante `ms` milisegundos; `action` (opcional) se ejecuta entre muestras. */
async function sample(g, label, ms, action = null, step = 60) {
  let peak = 0;
  let sumSquares = 0;
  let n = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (action) await action();
    const m = await g.meter();
    if (m) {
      peak = Math.max(peak, m.peak);
      sumSquares += m.rms * m.rms;
      n++;
    }
    await g.page.waitForTimeout(step);
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, n));
  console.log(`${label.padEnd(54)} pico ${fmt(db(peak))} dBFS   medio ${fmt(db(rms))} dBFS`);
  return { peak: db(peak), rms: db(rms) };
}

export async function runAudioCheck() {
  section('Volumen de la música por estilo (efectos apagados)');
  const levels = {};
  for (const style of ['swing', 'ambient']) {
    const g = await openGame({
      label: `audio-${style}`,
      seed: { user_settings: { hasSeenTutorial: true, soundEnabled: false, musicStyle: style } },
    });
    await g.tap(360, 1100, 100); // primer toque: desbloquea el audio y arranca la música
    await g.page.waitForTimeout(3500); // fundido de entrada
    levels[style] = await sample(g, `Música ${style} al 100 %, 14 s`, 14000);
    await g.close();
  }
  for (const style of ['swing', 'ambient']) {
    check(`${style}: se oye (volumen medio entre −48 y −24 dBFS)`, levels[style].rms > -48 && levels[style].rms < -24, `${levels[style].rms.toFixed(1)} dBFS`);
    check(`${style}: sin distorsión (pico por debajo de −3 dBFS)`, levels[style].peak < -3, `${levels[style].peak.toFixed(1)} dBFS`);
  }
  check('los dos estilos suenan a un volumen parecido (diferencia menor de 6 dB)', Math.abs(levels.swing.rms - levels.ambient.rms) < 6, `${(levels.swing.rms - levels.ambient.rms).toFixed(1)} dB`);

  section('La barra de volumen sube y baja el sonido de verdad');
  {
    const g = await openGame({ label: 'audio-volumen', seed: { user_settings: { hasSeenTutorial: true, soundEnabled: false } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    const standard = await sample(g, 'Música swing al 100 % (estándar), 14 s', 14000);

    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.volume(200), 300);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(1500);
    const loud = await sample(g, 'Música swing al 200 % (el doble), 14 s', 14000);

    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.volume(50), 300);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(1500);
    const soft = await sample(g, 'Música swing al 50 % (la mitad), 14 s', 14000);

    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.volume(0), 300);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(1500);
    const silent = await sample(g, 'Música swing al 0 % (silencio), 8 s', 8000);

    check('al 200 % suena más fuerte que al estándar', loud.rms > standard.rms + 2, `${(loud.rms - standard.rms).toFixed(1)} dB (esperado ≈ +6)`);
    check('al 50 % suena más bajo que al estándar', soft.rms < standard.rms - 2, `${(soft.rms - standard.rms).toFixed(1)} dB (esperado ≈ −6)`);
    check('al 0 % no se oye nada', silent.rms < -70, `${silent.rms.toFixed(1)} dBFS`);
    check('incluso al 200 % no distorsiona (pico por debajo de −1 dBFS)', loud.peak < -1, `${loud.peak.toFixed(1)} dBFS`);
    await g.close();
  }

  section('Música al 200 % más efectos: el limitador evita la distorsión');
  {
    const g = await openGame({ label: 'audio-mezcla', seed: { user_settings: { hasSeenTutorial: true, musicVolume: 200 } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    const mix = await sample(g, 'Música al 200 % + giros rápidos de casillas, 8 s', 8000, async () => {
      await g.tap(100 + Math.random() * 520, 650 + Math.random() * 500, 0);
    }, 40);
    check('la mezcla más fuerte posible no distorsiona (pico por debajo de −1 dBFS)', mix.peak < -1, `${mix.peak.toFixed(1)} dBFS`);
    check('y se sigue oyendo claramente (volumen medio por encima de −40 dBFS)', mix.rms > -40, `${mix.rms.toFixed(1)} dBFS`);
    await g.close();
  }

  section('Luces: la caja de música y sus efectos');
  {
    const seed = { hasSeenTutorial: true, hasSeenLightsTip: true, puzzle: 'lights' };
    let g = await openGame({ label: 'audio-luces-musica', seed: { user_settings: { ...seed, soundEnabled: false } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    const box = await sample(g, 'Música de Luces (caja de música) al 100 %, 14 s', 14000);
    check('Luces: la caja de música se oye (volumen medio entre −52 y −24 dBFS)', box.rms > -52 && box.rms < -24, `${box.rms.toFixed(1)} dBFS`);
    check('Luces: sin distorsión (pico por debajo de −3 dBFS)', box.peak < -3, `${box.peak.toFixed(1)} dBFS`);
    check('Luces: no suena mucho más fuerte que el estilo ambiental (diferencia menor de 8 dB)', Math.abs(box.rms - levels.ambient.rms) < 8, `${(box.rms - levels.ambient.rms).toFixed(1)} dB`);
    await g.close();

    g = await openGame({ label: 'audio-luces-mezcla', seed: { user_settings: { ...seed, musicVolume: 200 } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    const mix = await sample(g, 'Música al 200 % + toques rápidos en Luces, 8 s', 8000, async () => {
      await g.tap(100 + Math.random() * 520, 650 + Math.random() * 500, 0);
    }, 40);
    check('Luces: la mezcla más fuerte posible no distorsiona (pico por debajo de −1 dBFS)', mix.peak < -1, `${mix.peak.toFixed(1)} dBFS`);
    check('Luces: y se sigue oyendo claramente (volumen medio por encima de −40 dBFS)', mix.rms > -40, `${mix.rms.toFixed(1)} dBFS`);
    await g.close();
  }
}
