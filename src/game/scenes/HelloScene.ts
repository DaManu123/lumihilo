import Phaser from 'phaser';
import { APP_NAME } from '../../config';
import { THEME } from '../theme';

/**
 * Escena de prueba provisional para comprobar que Phaser renderiza
 * correctamente y que el input táctil / puntero funciona mediante un tween de 90°.
 */
export class HelloScene extends Phaser.Scene {
  private isRotating = false;

  constructor() {
    super({ key: 'HelloScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor(THEME.background);

    // Título APP_NAME centrado
    this.add
      .text(width / 2, height * 0.25, APP_NAME, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: THEME.text,
        align: 'center',
      })
      .setOrigin(0.5);

    // Subtítulo
    this.add
      .text(width / 2, height * 0.32, 'Fase 0 · Prueba de toque', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        color: THEME.primaryCss,
        align: 'center',
      })
      .setOrigin(0.5);

    // Cuadrado interactivo que gira 90 grados al tocarlo
    const size = Math.min(width, height) * 0.35;
    const box = this.add.rectangle(width / 2, height * 0.55, size, size, THEME.primary);
    box.setStrokeStyle(4, THEME.accent);
    box.setInteractive({ useHandCursor: true });

    // Texto de retroalimentación
    const hintText = this.add
      .text(width / 2, height * 0.78, 'Toca el cuadrado para girar 90°', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.mutedText,
        align: 'center',
      })
      .setOrigin(0.5);

    box.on('pointerdown', () => {
      if (this.isRotating) return;
      this.isRotating = true;

      this.tweens.add({
        targets: box,
        angle: box.angle + 90,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.isRotating = false;
        },
      });

      hintText.setText(`Rotación: ${box.angle + 90}°`);
    });
  }
}
