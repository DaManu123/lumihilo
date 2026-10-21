import Phaser from 'phaser';
import { HelloScene } from './game/scenes/HelloScene';
import { THEME } from './game/theme';
import { createServices } from './services';

// Inicializar servicios desacoplados (Storage, Ads, Haptics)
const services = createServices();
console.log('[Main] Servicios inicializados:', services);

// Configuración adaptada a pantalla vertical de smartphone (720x1280 base)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: THEME.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  scene: [HelloScene],
};

new Phaser.Game(config);
