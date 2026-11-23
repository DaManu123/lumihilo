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

const TRACKS = ['swing', 'ambient', 'cristal', 'hilo', 'lofi', 'marimba', 'synth', 'nocturne', 'chip'];

/** Pone un tema concreto (con `?debug`) y espera a que suene solo él (cambio en el siguiente compás + fundido cruzado). */
async function playTrack(g, track) {
  await g.page.evaluate((t) => window.__music.playTrack(t), track);
  const end = Date.now() + 10000;
  while (Date.now() < end && (await g.page.evaluate(() => window.__music.currentTrack())) !== track) await g.page.waitForTimeout(200);
  await g.page.waitForTimeout(4000);
}

export async function runAudioCheck() {
  section('Volumen de cada uno de los nueve temas (efectos apagados)');
  const levels = {};
  {
    const g = await openGame({ label: 'audio-temas', query: '?debug', seed: { user_settings: { hasSeenTutorial: true, soundEnabled: false } } });
    await g.tap(360, 1100, 100); // primer toque: desbloquea el audio y arranca la música
    await g.page.waitForTimeout(3500); // fundido de entrada
    for (const track of TRACKS) {
      await playTrack(g, track);
      levels[track] = await sample(g, `Tema ${track} al 100 %, 12 s`, 12000);
    }
    await g.close();
  }
  for (const track of TRACKS) {
    check(`${track}: se oye (volumen medio entre −48 y −24 dBFS)`, levels[track].rms > -48 && levels[track].rms < -24, `${levels[track].rms.toFixed(1)} dBFS`);
    check(`${track}: sin distorsión (pico por debajo de −3 dBFS)`, levels[track].peak < -3, `${levels[track].peak.toFixed(1)} dBFS`);
  }
  const rmsList = TRACKS.map((t) => levels[t].rms);
  const spread = Math.max(...rmsList) - Math.min(...rmsList);
  check('todos los temas suenan a un volumen parecido (del más bajo al más alto, menos de 8 dB)', spread < 8, `${spread.toFixed(1)} dB`);

  section('La barra de volumen sube y baja el sonido de verdad');
  {
    const g = await openGame({ label: 'audio-volumen', query: '?debug', seed: { user_settings: { hasSeenTutorial: true, soundEnabled: false } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    await playTrack(g, 'swing'); // siempre el mismo tema, para comparar solo el volumen
    const standard = await sample(g, 'Música swing al 100 % (estándar), 14 s', 14000);

    await g.openSettings(500);
    await g.tap(...g.pos.volume(200), 300);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(1500);
    const loud = await sample(g, 'Música swing al 200 % (el doble), 14 s', 14000);

    await g.openSettings(500);
    await g.tap(...g.pos.volume(50), 300);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(1500);
    const soft = await sample(g, 'Música swing al 50 % (la mitad), 14 s', 14000);

    await g.openSettings(500);
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

  section('Luces: música al 200 % más sus efectos');
  {
    const seed = { hasSeenTutorial: true, hasSeenLightsTip: true, puzzle: 'lights' };
    const g = await openGame({ label: 'audio-luces-mezcla', query: '?debug', seed: { user_settings: { ...seed, musicVolume: 200 } } });
    await g.tap(360, 1100, 100);
    await g.page.waitForTimeout(3500);
    // El tema con más ataque (sintetizador) es el peor caso para la mezcla
    await playTrack(g, 'synth');
    const mix = await sample(g, 'Sintetizador al 200 % + toques rápidos en Luces, 8 s', 8000, async () => {
      await g.tap(100 + Math.random() * 520, 650 + Math.random() * 500, 0);
    }, 40);
    check('Luces: la mezcla más fuerte posible no distorsiona (pico por debajo de −1 dBFS)', mix.peak < -1, `${mix.peak.toFixed(1)} dBFS`);
    check('Luces: y se sigue oyendo claramente (volumen medio por encima de −40 dBFS)', mix.rms > -40, `${mix.rms.toFixed(1)} dBFS`);
    await g.close();
  }
}
