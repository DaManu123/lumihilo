import Phaser from 'phaser';
import { BoardState, CellState, Direction } from '../../core/types';
import {
  computePowerFlow,
  checkVictory,
  rotateCell,
  hasDirection,
} from '../../core/grid';
import { createFixedLevel4x4 } from '../../core/fixedLevel';
import { THEME } from '../theme';
import { APP_NAME } from '../../config';

interface CellView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  wireGraphics: Phaser.GameObjects.Graphics;
  cell: CellState;
  row: number;
  col: number;
  isRotating: boolean;
}

export class GameScene extends Phaser.Scene {
  private board!: BoardState;
  private cellViews: CellView[][] = [];
  private isWon = false;
  private tapCount = 0;
  private elapsedTime = 0;
  private timerEvent?: Phaser.Time.TimerEvent;

  // Elementos de UI
  private timerText!: Phaser.GameObjects.Text;
  private tapsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor(THEME.background);

    this.isWon = false;
    this.tapCount = 0;
    this.elapsedTime = 0;

    // Iniciar modelo de datos del nivel fijo 4x4
    this.board = createFixedLevel4x4(true);

    this.createHeader(width);
    this.createBoard(width, height);
    this.updateFlowVisuals();

    // Cronómetro interno (actualiza cada segundo)
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.isWon) {
          this.elapsedTime++;
          this.timerText.setText(`Tiempo: ${this.formatTime(this.elapsedTime)}`);
        }
      },
    });
  }

  private createHeader(width: number): void {
    // Título superior
    this.add
      .text(width / 2, 70, APP_NAME, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 110, 'Fase 1 · Prototipo 4×4', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    // Contadores en cabecera
    this.tapsText = this.add
      .text(width * 0.25, 160, 'Toques: 0', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(width * 0.75, 160, 'Tiempo: 00:00', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    // Indicador sutil de objetivo
    this.add
      .text(width / 2, 210, '⚡ Conecta toda la energía desde la fuente', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: '#a0aec0',
      })
      .setOrigin(0.5);
  }

  private createBoard(width: number, height: number): void {
    const boardSize = Math.min(width * 0.88, 600);
    const cellSize = boardSize / 4;
    const spacing = 6;
    const effectiveCellSize = cellSize - spacing;
    const startX = (width - boardSize) / 2 + cellSize / 2;
    const startY = height * 0.52 - boardSize / 2 + cellSize / 2;

    this.cellViews = [];

    for (let r = 0; r < 4; r++) {
      const rowViews: CellView[] = [];
      for (let c = 0; c < 4; c++) {
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const cell = this.board.grid[r][c];

        const container = this.add.container(x, y);

        // Fondo de la celda
        const bg = this.add
          .rectangle(0, 0, effectiveCellSize, effectiveCellSize, THEME.surface)
          .setStrokeStyle(cell.isSource ? 3 : 1.5, cell.isSource ? THEME.accent : 0x30363d)
          .setInteractive({ useHandCursor: true });

        // Capa de gráficos para cables
        const wireGraphics = this.add.graphics();

        container.add([bg, wireGraphics]);
        // Ajustar el ángulo inicial del contenedor según la rotación de la celda
        container.setAngle(cell.rotation * 90);

        const view: CellView = {
          container,
          bg,
          wireGraphics,
          cell,
          row: r,
          col: c,
          isRotating: false,
        };

        // Manejador táctil / clic
        bg.on('pointerdown', () => this.handleCellTap(view));

        rowViews.push(view);
      }
      this.cellViews.push(rowViews);
    }
  }

  private handleCellTap(view: CellView): void {
    if (this.isWon || view.isRotating) return;

    view.isRotating = true;
    this.tapCount++;
    this.tapsText.setText(`Toques: ${this.tapCount}`);

    // Rotar en el modelo lógico
    rotateCell(this.board, view.row, view.col);

    // Animación visual suave de giro de 90 grados
    const targetAngle = view.container.angle + 90;

    this.tweens.add({
      targets: view.container,
      angle: targetAngle,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
        this.evaluateVictory();
      },
    });

    // Actualización inmediata del flujo para feedback instantáneo
    this.updateFlowVisuals();
  }

  /**
   * Redibuja los cables de cada celda según su estado de alimentación.
   */
  private updateFlowVisuals(): void {
    const powered = computePowerFlow(this.board);
    const boardSize = Math.min(this.cameras.main.width * 0.88, 600);
    const cellSize = boardSize / 4;
    const effectiveCellSize = cellSize - 6;
    const half = effectiveCellSize / 2;
    const wireWidth = Math.max(8, effectiveCellSize * 0.12);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const view = this.cellViews[r][c];
        const isCellPowered = powered[r][c];
        const g = view.wireGraphics;
        g.clear();

        const mask = view.cell.baseMask; // Dibujamos con baseMask porque el container ya rota
        const color = isCellPowered ? THEME.primary : 0x3b4252;
        const centerColor = view.cell.isSource
          ? THEME.accent
          : isCellPowered
            ? THEME.primary
            : 0x3b4252;

        g.lineStyle(wireWidth, color, 1);

        // Ramas de cables desde el centro hacia los bordes
        if (hasDirection(mask, Direction.NORTH)) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, -half);
          g.strokePath();
        }
        if (hasDirection(mask, Direction.EAST)) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(half, 0);
          g.strokePath();
        }
        if (hasDirection(mask, Direction.SOUTH)) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, half);
          g.strokePath();
        }
        if (hasDirection(mask, Direction.WEST)) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(-half, 0);
          g.strokePath();
        }

        // Núcleo central
        const hubRadius = view.cell.isSource ? wireWidth * 1.3 : wireWidth * 0.8;
        g.fillStyle(centerColor, 1);
        g.fillCircle(0, 0, hubRadius);

        // Si es la fuente, agregar aro distintivo
        if (view.cell.isSource) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeCircle(0, 0, hubRadius + 4);
        }

        // Color del borde del recuadro
        view.bg.setStrokeStyle(
          view.cell.isSource ? 3 : 1.5,
          view.cell.isSource ? THEME.accent : isCellPowered ? 0x00f0ff : 0x30363d
        );
      }
    }
  }

  private evaluateVictory(): void {
    if (this.isWon) return;

    if (checkVictory(this.board)) {
      this.isWon = true;
      if (this.timerEvent) this.timerEvent.remove();

      this.showVictoryModal();
    }
  }

  private showVictoryModal(): void {
    const { width, height } = this.cameras.main;

    const overlay = this.add.container(width / 2, height / 2);
    overlay.setAlpha(0);

    // Fondo semitransparente oscuro
    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.85)
      .setInteractive();

    // Tarjeta modal de victoria
    const cardWidth = Math.min(width * 0.85, 480);
    const cardHeight = 360;
    const card = this.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x161b22, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -110, '¡CIRCUITO COMPLETO!', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -65, 'Energía restablecida con éxito', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    // Métricas de desempeño
    const statsText = this.add
      .text(
        0,
        5,
        `⏱️ Tiempo: ${this.formatTime(this.elapsedTime)}\n👆 Toques: ${this.tapCount}`,
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '20px',
          color: '#e6edf3',
          align: 'center',
          lineSpacing: 10,
        }
      )
      .setOrigin(0.5);

    // Botón "Jugar otra vez"
    const btnWidth = cardWidth * 0.75;
    const btnHeight = 56;
    const btnBg = this.add
      .rectangle(0, 95, btnWidth, btnHeight, THEME.primary)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add
      .text(0, 95, 'Jugar otra vez', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#0d1117',
      })
      .setOrigin(0.5);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0x38f9d7));
    btnBg.on('pointerout', () => btnBg.setFillStyle(THEME.primary));
    btnBg.on('pointerdown', () => {
      this.scene.restart();
    });

    overlay.add([backdrop, card, title, subtitle, statsText, btnBg, btnText]);

    // Animación de entrada suave
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 350,
      ease: 'Power2',
    });
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
