'use strict';

/**
 * Versión de escritorio de Lumihilo (Windows y Linux).
 *
 * Es solo un contenedor: carga el mismo juego web que genera `npm run build` (carpeta `dist/`).
 * Se sirve con un protocolo propio (`app://game/`) en vez de `file://`, que es el patrón recomendado:
 * da un origen seguro y estable, de modo que el progreso guardado (localStorage) no depende de la
 * ruta donde esté instalada la aplicación.
 */

const { app, BrowserWindow, Menu, net, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'game';
const BACKGROUND = '#0b1026';

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// Muchas distribuciones de Linux (p. ej. Ubuntu 24.04) bloquean el "sandbox" de Chromium para
// aplicaciones AppImage. El juego solo carga sus propios archivos locales, así que se desactiva ahí.
if (process.platform === 'linux' && process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox');
}

const smokeOutput = process.env.PUZZLE_SMOKE_TEST || '';

/** Carpeta con el juego: empaquetada junto a la aplicación o, en desarrollo, la carpeta `dist/` del proyecto. */
function gameRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'game') : path.resolve(__dirname, '..', 'dist');
}

function registerGameProtocol() {
  const root = gameRoot();
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('No encontrado', { status: 404 });

    let relative = decodeURIComponent(url.pathname);
    if (relative === '/' || relative === '') relative = '/index.html';

    // Nunca se sirve nada fuera de la carpeta del juego
    const file = path.normalize(path.join(root, relative));
    if (file !== root && !file.startsWith(root + path.sep)) return new Response('Prohibido', { status: 403 });

    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  // El juego es vertical: la ventana se adapta al alto disponible de la pantalla
  const { height: available } = screen.getPrimaryDisplay().workAreaSize;
  const height = Math.max(640, Math.min(940, available - 60));
  const width = Math.round(height * 0.56);

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 360,
    minHeight: 640,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    title: 'Lumihilo',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // El juego no abre ventanas nuevas ni navega fuera de sí mismo
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(`${SCHEME}://${HOST}/`)) event.preventDefault();
  });

  // F11: pantalla completa. Esc: salir de pantalla completa. F12: herramientas de desarrollo (útil en la beta).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.loadURL(`${SCHEME}://${HOST}/index.html`);

  if (smokeOutput) win.webContents.once('did-finish-load', () => void runSmokeTest(win, smokeOutput));
  return win;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prueba de humo para las compilaciones: arranca el juego, comprueba que el lienzo, las tipografías y el
 * guardado funcionan, deja un informe JSON y una captura, y cierra con código 0 (todo bien) o 1.
 * Solo se activa con la variable de entorno PUZZLE_SMOKE_TEST=<ruta del informe>.
 */
async function runSmokeTest(win, reportFile) {
  const result = { ok: false, checks: {}, error: null };
  try {
    const probe = () =>
      win.webContents.executeJavaScript(`(() => {
        const canvas = document.querySelector('canvas');
        let storage = false;
        try { localStorage.setItem('__smoke', '1'); storage = localStorage.getItem('__smoke') === '1'; localStorage.removeItem('__smoke'); } catch (e) {}
        return {
          protocol: location.protocol,
          canvas: !!canvas,
          canvasWidth: canvas ? canvas.width : 0,
          fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
          storage,
          gameStarted: !!localStorage.getItem('player_progress'),
        };
      })()`);

    let state = await probe();
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline && !(state.canvas && state.gameStarted && state.fonts.length >= 2)) {
      await sleep(500);
      state = await probe();
    }

    result.checks = state;
    result.ok =
      state.protocol === `${SCHEME}:` &&
      state.canvas &&
      state.canvasWidth === 720 &&
      state.gameStarted &&
      state.storage &&
      state.fonts.some((f) => f.includes('Unbounded')) &&
      state.fonts.some((f) => f.includes('Atkinson'));

    await sleep(800);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(reportFile.replace(/\.json$/i, '') + '.png', image.toPNG());
  } catch (error) {
    result.error = String(error);
  }
  fs.writeFileSync(reportFile, JSON.stringify(result, null, 2));
  app.exit(result.ok ? 0 : 1);
}

if (!smokeOutput && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('Lumihilo');
  // Los datos guardados (progreso, ajustes) viven en la carpeta del nombre anterior: se conserva para que
  // quien ya jugaba no pierda su progreso al cambiar el nombre del juego.
  app.setPath('userData', path.join(app.getPath('appData'), 'Lumihilo'));
  app.setAppUserModelId('com.damanu.lumihilo');

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerGameProtocol();
    Menu.setApplicationMenu(null);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
