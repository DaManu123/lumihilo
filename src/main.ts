import Phaser from 'phaser';
import '@fontsource-variable/unbounded/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import { GameScene } from './game/scenes/GameScene';
import { HelloScene } from './game/scenes/HelloScene';
import { THEME } from './game/theme';
import { DESIGN_WIDTH, computeGameHeight } from './game/layout';
import { createServices } from './services';

// Inicializar servicios desacoplados (Storage, Ads, Haptics)
const services = createServices();
console.log('[Main] Servicios inicializados:', services);

/**
 * El lienzo de Phaser dibuja el texto una sola vez: si la tipografía aún no está cargada usaría la
 * de respaldo y no se corregiría. Se espera a que carguen (con un tope por si falla la carga).
 */
async function loadFonts(): Promise<void> {
  const sample = 'Reto diario ñ áéíóú ¿? × 0123456789';
  const loading = Promise.all([
    document.fonts.load('700 28px "Unbounded Variable"', sample),
    document.fonts.load('500 28px "Atkinson Hyperlegible Next Variable"', sample),
    document.fonts.load('700 28px "Atkinson Hyperlegible Next Variable"', sample),
  ]);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
  await Promise.race([loading, timeout]).catch(() => undefined);
}

// Lienzo de ancho lógico fijo y alto según la proporción de la pantalla, para ocupar todo
// el dispositivo (teléfonos 16:9, 20:9, etc.) sin franjas vacías
function startGame(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: THEME.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: DESIGN_WIDTH,
      height: computeGameHeight(window.innerWidth, window.innerHeight),
    },
    scene: [GameScene, HelloScene],
  };
  const game = new Phaser.Game(config);
  // Solo para las pruebas de rendimiento (`?debug` en la dirección)
  if (location.search.includes('debug')) (window as unknown as { __game: Phaser.Game }).__game = game;
}

loadFonts().then(startGame);
