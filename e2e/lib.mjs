// Utilidades compartidas de las pruebas de navegador.
//
// El juego se dibuja en un <canvas>, así que no hay botones HTML que seleccionar: se toca por coordenadas
// lógicas del lienzo (720 de ancho; el alto depende de la pantalla) y se comprueba el estado guardado en
// localStorage después de cada acción.
import { chromium } from 'playwright';

export const URL = 'http://localhost:4173/';

export const results = [];
export const consoleErrors = [];

export function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${name}${detail ? '  → ' + detail : ''}`);
}

export function section(title) {
  console.log(`\n=== ${title} ===`);
}

let browser;
export async function launch(args = []) {
  browser = await chromium.launch({ args });
  return browser;
}
export const close = () => browser?.close();

/** Fecha de hoy (YYYY-MM-DD, hora local), igual que usa el juego. */
export const today = () => new Date().toLocaleDateString('en-CA');

/** Ajustes ya vistos el tutorial, para que no tape el tablero. */
export const SEEN_TUTORIAL = { user_settings: { hasSeenTutorial: true } };

/** Progreso completo con muchas Chispas: permite resolver niveles solo con pistas. */
export const RICH = {
  player_progress: {
    seedBase: 1234,
    currentLevel: 1,
    sparks: 9999,
    stats: { levelsSolved: 0, perfectSolves: 0, dailyCompleted: 0, bestTimeByTier: {} },
    streak: { current: 0, best: 0, lastActiveDate: null },
    lastDailyCompleted: null,
  },
};

/**
 * Abre el juego en un contexto limpio. Devuelve utilidades para tocar el lienzo, leer el estado guardado
 * y contar lo que suena y vibra (se instrumentan AudioContext y navigator.vibrate antes de cargar).
 */
export async function openGame({ width = 393, height = 808, mobile = true, reducedMotion = 'no-preference', seed = null, label = '', out = '.' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__osc = 0;
    window.__vib = 0;
    window.__src = 0;
    const A = window.AudioContext;
    if (A) {
      window.AudioContext = class extends A {
        createOscillator() { window.__osc++; return super.createOscillator(); }
        createBufferSource() { window.__src++; return super.createBufferSource(); }
      };
    }
    // Medidor: copia lo que llega a la salida de audio a un analizador para medir el volumen real
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...rest) {
      if (typeof AudioDestinationNode !== 'undefined' && destination instanceof AudioDestinationNode && !this.__tapped) {
        const c = this.context;
        if (!c.__analyser) {
          const analyser = c.createAnalyser();
          analyser.fftSize = 2048;
          c.__analyser = analyser;
          window.__analyser = analyser;
        }
        connect.call(this, c.__analyser);
        this.__tapped = true;
      }
      return connect.call(this, destination, ...rest);
    };
    window.__meter = () => {
      const analyser = window.__analyser;
      if (!analyser) return null;
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      let sum = 0;
      for (const v of buffer) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      return { peak, rms: Math.sqrt(sum / buffer.length) };
    };
    const vibrate = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
    navigator.vibrate = (pattern) => { window.__vib++; return vibrate ? vibrate(pattern) : true; };
  });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${label}] PAGEERROR ${e.message}`));

  await page.goto(URL);
  if (seed) {
    await page.evaluate((s) => {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, seed);
    await page.reload();
  }
  await page.waitForSelector('canvas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1300);

  const g = { ctx, page };
  g.dims = await page.evaluate(() => ({ w: document.querySelector('canvas').width, h: document.querySelector('canvas').height }));
  g.at = async (lx, ly) => {
    const box = await (await page.$('canvas')).boundingBox();
    return { x: box.x + (lx * box.width) / g.dims.w, y: box.y + (ly * box.height) / g.dims.h };
  };
  g.tap = async (lx, ly, wait = 350) => {
    const p = await g.at(lx, ly);
    if (mobile) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(wait);
  };
  g.state = () => page.evaluate(() => {
    const read = (k) => {
      const raw = localStorage.getItem(k);
      if (raw === null) return null;
      try { return JSON.parse(raw); } catch { return { __raw: raw }; }
    };
    return { progress: read('player_progress'), settings: read('user_settings'), profile: read('profile_adaptive') };
  });
  g.reload = async () => { await page.reload(); await page.waitForSelector('canvas'); await page.waitForTimeout(1300); };
  g.audio = () => page.evaluate(() => ({ osc: window.__osc, vib: window.__vib, src: window.__src }));
  g.meter = () => page.evaluate(() => (window.__meter ? window.__meter() : null));
  g.shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
  g.close = () => ctx.close();

  // Posiciones lógicas de la interfaz (ver src/game/layout.ts y las tarjetas de GameScene.ts)
  const H = g.dims.h;
  g.pos = {
    mode: [136, 158], daily: [360, 158], theme: [584, 158],
    reset: [136, 378], undo: [360, 378], hint: [584, 378],
    dir: [360, 502], stats: [650, 56],
    tutorialOk: [360, H / 2 + 700 / 2 - 84],
    // Estadísticas (tarjeta de 862 px): "Ajustes" a la izquierda y "Cerrar" a la derecha
    statsSettings: [360 - 144.5, H / 2 + 862 / 2 - 84], statsClose: [360 + 144.5, H / 2 + 862 / 2 - 84],
    // Ajustes (tarjeta de 1150 px)
    setEffects: [360, H / 2 - 405], setMusic: [360, H / 2 - 321],
    styleSwing: [220, H / 2 - 147], styleAmbient: [500, H / 2 - 147],
    volume: (percent) => [92 + (536 * percent) / 200, H / 2 + 9],
    setHaptics: [360, H / 2 + 109],
    levelSoft: [360 - 186.7, H / 2 + 283], levelNormal: [360, H / 2 + 283], levelStrong: [360 + 186.7, H / 2 + 283],
    diagnose: [360, H / 2 + 369], settingsDone: [360, H / 2 + 491],
    // Diagnóstico de vibración (tarjeta de 1150 px)
    modeAll: [136, H / 2 + 199], modeSystem: [248, H / 2 + 199], modeMotor: [360, H / 2 + 199], modeTouch: [472, H / 2 + 199], modeAlarm: [584, H / 2 + 199],
    hapticsTest: [360 - 144.5, H / 2 + 491], hapticsDone: [360 + 144.5, H / 2 + 491],
  };
  return g;
}

/**
 * Pulsa "Pista" hasta resolver el nivel. Devuelve cuántas pistas se cobraron y cuántas Chispas ganó.
 * Usa como referencia el estado inicial y espera a que se registre cada cobro, para no perder la victoria
 * si el guardado llega con retraso en tableros grandes.
 */
export async function winWithHints(g, maxTaps = 120) {
  const start = (await g.state()).progress;
  const baseSolved = start.stats.levelsSolved;
  let charged = 0;
  let last = start.sparks;
  for (let i = 0; i < maxTaps; i++) {
    await g.tap(...g.pos.hint, 0);
    await g.page
      .waitForFunction((prev) => JSON.parse(localStorage.getItem('player_progress')).sparks !== prev, last, { timeout: 1500 })
      .catch(() => undefined); // si el toque se ignoró (la pieza aún giraba) no hay cobro
    await g.page.waitForTimeout(450); // giro de la pieza + guardado de la victoria
    const after = await g.state();
    const sparks = after.progress.sparks;
    if (after.progress.stats.levelsSolved > baseSolved) {
      charged += 1; // la pista ganadora ya estaba cobrada; lo que sobre es la recompensa del nivel
      const reward = sparks - (start.sparks - 10 * charged);
      await g.page.waitForTimeout(1600); // pulso de luz + tarjeta de resultados
      return { hints: charged, reward, after };
    }
    if (sparks < last) charged += Math.round((last - sparks) / 10);
    last = sparks;
  }
  return null;
}
