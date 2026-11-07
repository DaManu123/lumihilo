// Ejecuta las pruebas de navegador: compila el juego, levanta el servidor de vista previa, corre los
// escenarios (o la medición de audio con --audio) y lo apaga todo.
//
// Uso (desde la raíz del proyecto): npm run test:e2e
// Requisitos: tener Chromium de Playwright (npx playwright install chromium) y haber hecho `npm install`
// en la raíz y en e2e/.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { close, launch, results } from './lib.mjs';
import { runGameScenarios } from './game.mjs';
import { runAudioCheck } from './audio.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.E2E_OUT || path.join(import.meta.dirname, 'artifacts'));
const audioMode = process.argv.includes('--audio');
mkdirSync(out, { recursive: true });

if (!process.argv.includes('--no-build')) {
  console.log('Compilando el juego…');
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
if (!(await portFree(4173))) {
  console.error('El puerto 4173 ya está en uso: cierra el servidor anterior antes de ejecutar las pruebas.');
  process.exit(1);
}

// Servidor de vista previa de Vite, en el mismo proceso (funciona igual en Linux, macOS y Windows)
const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await preview({ root, logLevel: 'error', preview: { port: 4173, strictPort: true, host: '127.0.0.1' } });

let exitCode = 0;
try {
  await launch(audioMode ? ['--autoplay-policy=no-user-gesture-required'] : []);
  if (audioMode) await runAudioCheck();
  else await runGameScenarios(out);
} catch (error) {
  console.error('\nLa prueba se interrumpió:', error);
  exitCode = 1;
} finally {
  await close();
  await server.close();
}

if (!audioMode) {
  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumen: ${results.length - failed.length}/${results.length} comprobaciones correctas`);
  if (failed.length) {
    console.log('Fallos:');
    for (const f of failed) console.log(' -', f.name, f.detail);
    exitCode = 1;
  }
  console.log(`Capturas en: ${out}`);
}
process.exit(exitCode);
