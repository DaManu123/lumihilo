import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import { HelloScene } from './game/scenes/HelloScene';
import { THEME } from './game/theme';
import { DESIGN_WIDTH, computeGameHeight } from './game/layout';
import { createServices } from './services';

// Inicializar servicios desacoplados (Storage, Ads, Haptics)
const services = createServices();
console.log('[Main] Servicios inicializados:', services);

// Lienzo de ancho lógico fijo y alto según la proporción de la pantalla, para ocupar todo
// el dispositivo (teléfonos 16:9, 20:9, etc.) sin franjas vacías
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

new Phaser.Game(config);
