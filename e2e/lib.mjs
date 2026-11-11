// Utilidades compartidas de las pruebas de navegador.
//
// El juego se dibuja en un <canvas>, así que no hay botones HTML que seleccionar: se toca por coordenadas
// lógicas del lienzo (720 de ancho; el alto depende de la pantalla) y se comprueba el estado guardado en
// localStorage después de cada acción.
import { AsyncLocalStorage } from 'node:async_hooks';
import { chromium } from 'playwright';

export const URL = 'http://localhost:4173/';

export const results = [];
export const consoleErrors = [];

// Cada escenario que corre en paralelo acumula su salida y la imprime entera al terminar (sin mezclarse con otros)
const scenarioLog = new AsyncLocalStorage();

export function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const line = `${ok ? 'OK   ' : 'FALLA'} ${name}${detail ? '  → ' + detail : ''}`;
  const store = scenarioLog.getStore();
  if (store) store.lines.push(line);
  else console.log(line);
}

/**
 * Ejecuta escenarios independientes (`[título, función]`) con hasta `E2E_JOBS` a la vez (3 por defecto; 1 = en serie).
 * Cada uno abre sus propios contextos de navegador, que no comparten almacenamiento. Los más largos van primero para
 * repartir mejor la carga, y la salida de cada uno se imprime completa, con su duración, cuando termina.
 */
export async function runSections(sections) {
  const jobs = Math.max(1, Number(process.env.E2E_JOBS || 3));
  const only = process.env.E2E_ONLY ? process.env.E2E_ONLY.split(',') : null; // p. ej. E2E_ONLY=18,19
  const queue = sections.filter(([title]) => !only || only.some((id) => title.startsWith(id + '. ')));
  const started = Date.now();
  const failures = [];
  // Un Chromium por trabajador: con un solo navegador todos los contextos comparten el mismo proceso de gráficos
  // (WebGL por software) y, con más de dos a la vez, se atascan unos a otros
  const worker = async (index) => {
    const own = jobs > 1 ? await launchBrowser(launchArgs) : browser;
    const store = { lines: null, browser: own };
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [title, run] = next;
      const lines = [];
      store.lines = lines;
      const t0 = Date.now();
      try {
        await scenarioLog.run(store, run);
      } catch (error) {
        results.push({ name: `${title}: el escenario se interrumpió`, ok: false, detail: String(error?.message ?? error) });
        lines.push(`FALLA ${title}: el escenario se interrumpió  → ${error?.stack ?? error}`);
        failures.push(title);
      }
      console.log(`\n=== ${title} (${((Date.now() - t0) / 1000).toFixed(0)} s) ===\n${lines.join('\n')}`);
    }
    if (own !== browser) await own.close();
  };
  // Los escenarios más largos (por tamaño de código) primero
  queue.sort((a, b) => b[1].toString().length - a[1].toString().length);
  await Promise.all(Array.from({ length: jobs }, (_, i) => worker(i)));
  console.log(`\nEscenarios: ${((Date.now() - started) / 1000).toFixed(0)} s con ${jobs} en paralelo`);
}

export function section(title) {
  console.log(`\n=== ${title} ===`);
}

let browser;
let launchArgs = [];
const launchBrowser = (args) =>
  // SwiftShader explícito: en máquinas sin GPU (WSL, CI) el WebGL por software va el doble de rápido que el predeterminado
  chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...args] });
export async function launch(args = []) {
  launchArgs = args;
  browser = await launchBrowser(args);
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
export async function openGame({ width = 393, height = 808, mobile = true, reducedMotion = 'no-preference', seed = null, label = '', out = '.', locale = 'es-MX', query = '', beforeLoad = null, scale = 1, menu = false, announce = false } = {}) {
  const ctx = await (scenarioLog.getStore()?.browser ?? browser).newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion,
    locale,
  });
  ctx.setDefaultTimeout(60000); // con varios navegadores a la vez la carga puede tardar más
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

  if (beforeLoad) await beforeLoad(page);
  await page.goto(URL + query);
  // El aviso de una sola vez de los gráficos altos taparía el menú en todas las pruebas: se da por visto salvo `announce`
  if (seed && !announce && seed.user_settings && typeof seed.user_settings === 'object' && !('hasSeenGraphicsNotice' in seed.user_settings)) {
    seed = { ...seed, user_settings: { ...seed.user_settings, hasSeenGraphicsNotice: true } };
  }
  if (seed) {
    await page.evaluate((s) => {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, seed);
    await page.reload();
  }
  await page.waitForSelector('canvas');
  // «networkidle» puede no llegar nunca con varios navegadores arrancando a la vez: se intenta un rato y se sigue,
  // y lo que importa de verdad es que las tipografías estén listas (el texto del lienzo las usa)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
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
    // Ajustes y Aspectos se abren desde el menú y al cerrarlos se vuelve a él: las pruebas siguen jugando, así que se reentra
    if (g.menuOpen && g.pos && [g.pos.settingsDone, g.pos.skinsDone].some(([x, y]) => x === lx && y === ly)) await g.enter();
  };
  // Arrastra el ratón (o el dedo) por una lista de puntos del lienzo: pulsa en el primero, pasa por los demás y suelta
  g.drag = async (points, wait = 350, stepWait = 40) => {
    const first = await g.at(...points[0]);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const point of points.slice(1)) {
      const p = await g.at(...point);
      await page.mouse.move(p.x, p.y, { steps: 3 });
      await page.waitForTimeout(stepWait);
    }
    await page.mouse.up();
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
  g.reload = async () => {
    await page.reload();
    await page.waitForSelector('canvas');
    await page.waitForTimeout(1300);
    g.menuOpen = true; // la app siempre abre en el menú, en su pantalla de inicio
    g.menuScreen = 'home';
    if (!menu) await g.enter();
  };
  g.audio = () => page.evaluate(() => ({ osc: window.__osc, vib: window.__vib, src: window.__src }));
  g.meter = () => page.evaluate(() => (window.__meter ? window.__meter() : null));
  g.shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
  g.close = () => ctx.close();

  // Posiciones lógicas de la interfaz (ver src/game/layout.ts y las tarjetas de GameScene.ts)
  const H = g.dims.h;
  g.pos = {
    mode: [136, 158], daily: [360, 158], theme: [584, 158],
    reset: [136, 378], undo: [360, 378], hint: [584, 378],
    dir: [360, 502], stats: [650, 56], back: [124, 56],
    // Tutoriales de varias pantallas (tarjeta de 1090 px): «Saltar» y «Siguiente» abajo; en la última, «Entendido» en el centro
    tutorialOk: [360 - 144.5, H / 2 + 1090 / 2 - 84], tutorialSkip: [360 - 144.5, H / 2 + 1090 / 2 - 84],
    tutorialNext: [360 + 144.5, H / 2 + 1090 / 2 - 84], tutorialDone: [360, H / 2 + 1090 / 2 - 84], help: [136, 158],
    // Estadísticas (tarjeta de 900 px): solo los números y «Cerrar»
    statsClose: [360, H / 2 + 900 / 2 - 84],
    // Menú, pantalla de inicio (computeHomeLayout): «Jugar» y los accesos en columna
    homePlay: [360, Math.round(H * 0.44)], homeSkins: [360, Math.round(H * 0.44) + 140],
    homeStats: [360, Math.round(H * 0.44) + 256], homeSettings: [360, Math.round(H * 0.44) + 372],
    // Menú, pantalla de puzzles (computePlayLayout): «Volver», tarjetas y modos
    playBack: [124, 56], menuCard: (i) => [360, (H - 70) / 2 + (i - 1) * 196], menuMode: (i) => [360 + (i - 1) * 228, H - 190],
    // Aspectos (tarjeta de 1220 px, filas de 130 px)
    skinRow: (i) => [360, H / 2 - 385 + 130 * i], skinsDone: [360, H / 2 + 526],
    // Ajustes con el botón «Buscar actualizaciones» (solo en la app y con ?debug&update): tarjeta de 1254 px
    settingsUpdates: [360, H / 2 + 424],
    // Aviso de una vez de los gráficos altos (tarjeta de 560 px)
    graphicsLater: [215.5, H / 2 + 196], graphicsSettings: [504.5, H / 2 + 196],
    // Mini tutorial de Luces (tarjeta de 1090 px) y panel de luces (siempre en [360, 502])
    lightsTutorialOk: [360 - 144.5, H / 2 + 1090 / 2 - 84], flowTutorialOk: [360, H / 2 + 1090 / 2 - 84], lightsPanel: [360, 502],
    // Aviso de versión nueva (tarjeta de 620 px)
    updateLater: [360 - 144.5, H / 2 + 226], updateNow: [360 + 144.5, H / 2 + 226],
    // Ajustes (tarjeta de 1160 px): gráficos arriba (control a la derecha), efectos y música en la misma fila
    setGraphicsNormal: [415, H / 2 - 410], setGraphicsHigh: [565, H / 2 - 410],
    setEffects: [215.5, H / 2 - 306], setMusic: [513.5, H / 2 - 306],
    styleSwing: [220, H / 2 - 138], styleAmbient: [500, H / 2 - 138],
    volume: (percent) => [92 + (536 * percent) / 200, H / 2 + 10],
    setHaptics: [360, H / 2 + 102],
    levelSoft: [360 - 186.7, H / 2 + 276], levelNormal: [360, H / 2 + 276], levelStrong: [360 + 186.7, H / 2 + 276],
    accessibility: [215.5, H / 2 + 372], diagnose: [504.5, H / 2 + 372], settingsDone: [360, H / 2 + 496],
    // Accesibilidad (tarjeta de 990 px)
    accContrast: [360, H / 2 - 325], accMarks: [360, H / 2 - 235],
    accNormal: [173, H / 2 + 69], accFast: [360, H / 2 + 69], accOff: [547, H / 2 + 69],
    langAuto: [173, H / 2 + 239], langEs: [360, H / 2 + 239], langEn: [547, H / 2 + 239], accDone: [360, H / 2 + 411],
    // Diagnóstico de vibración (tarjeta de 1150 px)
    modeAll: [136, H / 2 + 199], modeSystem: [248, H / 2 + 199], modeMotor: [360, H / 2 + 199], modeTouch: [472, H / 2 + 199], modeAlarm: [584, H / 2 + 199],
    hapticsTest: [360 - 144.5, H / 2 + 491], hapticsDone: [360 + 144.5, H / 2 + 491],
  };
  // Menú principal: la app siempre abre en él. Salvo `menu: true`, se entra al puzzle guardado para jugar
  const PUZZLE_ORDER = ['circuits', 'lights', 'flow'];
  const savedPuzzle = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('user_settings') ?? '{}')?.puzzle ?? 'circuits'; } catch { return 'circuits'; }
  });
  // El menú tiene dos pantallas: la de inicio («Jugar» y los accesos) y la de puzzles (tarjetas y modo)
  g.menuOpen = true;
  g.menuScreen = 'home';
  /** Desde el juego, «Volver» lleva a la pantalla de puzzles. */
  g.openMenu = async (wait = 500) => {
    if (g.menuOpen) return;
    await g.tap(...g.pos.back, wait);
    g.menuOpen = true;
    g.menuScreen = 'play';
  };
  g.toPlayScreen = async (wait = 500) => {
    await g.openMenu();
    if (g.menuScreen === 'home') await g.tap(...g.pos.homePlay, wait);
    g.menuScreen = 'play';
  };
  g.toHome = async (wait = 500) => {
    await g.openMenu();
    if (g.menuScreen === 'play') await g.tap(...g.pos.playBack, wait);
    g.menuScreen = 'home';
  };
  g.enter = async (puzzle, wait = 700) => {
    const index = Math.max(0, PUZZLE_ORDER.indexOf(puzzle ?? (await savedPuzzle())));
    await g.toPlayScreen();
    g.menuOpen = false;
    await g.tap(...g.pos.menuCard(index), wait);
  };
  g.playPuzzle = async (puzzle, wait = 900) => { await g.openMenu(); await g.enter(puzzle, wait); };
  g.openSettings = async (wait = 500) => { await g.toHome(); await g.tap(...g.pos.homeSettings, wait); };
  g.openSkins = async (wait = 600) => { await g.toHome(); await g.tap(...g.pos.homeSkins, wait); };
  if (!menu) await g.enter();
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
      .waitForFunction((prev) => JSON.parse(localStorage.getItem('player_progress')).sparks !== prev, last, { timeout: 5000 })
      .catch(() => undefined); // si el toque se ignoró (la pieza aún giraba) no hay cobro; con varios navegadores a la vez el cobro puede tardar
    await g.page.waitForTimeout(450); // giro de la pieza + guardado de la victoria
    const after = await g.state();
    const sparks = after.progress.sparks;
    if (after.progress.stats.levelsSolved > baseSolved) {
      charged += 1; // la pista ganadora ya estaba cobrada; lo que sobre es la recompensa del nivel
      // Con ?debug se lee del juego cuántas pistas se usaron: deducirlo de los cambios de saldo falla con mucha carga
      const exact = await g.page.evaluate(() => window.__game?.scene?.scenes?.find((sc) => sc.handleCellTap)?.hintsUsed);
      if (Number.isInteger(exact)) charged = exact;
      const reward = sparks - (start.sparks - 10 * charged);
      await g.page.waitForTimeout(1600); // pulso de luz + tarjeta de resultados
      return { hints: charged, reward, after };
    }
    if (sparks < last) charged += Math.round((last - sparks) / 10);
    last = sparks;
  }
  return null;
}
