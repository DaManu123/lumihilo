import Phaser from 'phaser';
import { BoardState, CellState, Direction, LevelParams, GeneratedLevel } from '../../core/types';
import {
  computePowerFlow,
  checkVictory,
  rotateCell,
  hasDirection,
} from '../../core/grid';
import { generateLevel } from '../../core/generator';
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
  private currentLevelIndex = 1;
  private currentLevelData!: GeneratedLevel;
  private board!: BoardState;
  private cellViews: CellView[][] = [];
  private isWon = false;
  private tapCount = 0;
  private elapsedTime = 0;
  private timerEvent?: Phaser.Time.TimerEvent;

  // Elementos de UI
  private levelText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tapsText!: Phaser.GameObjects.Text;
  private connectedText!: Phaser.GameObjects.Text;
  private boardContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width } = this.cameras.main;
    this.cameras.main.setBackgroundColor(THEME.background);

    this.boardContainer = this.add.container(0, 0);

    this.createHeader(width);
    this.startLevel(this.currentLevelIndex);

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

  private getLevelParams(index: number): LevelParams {
    if (index === 1) {
      return { width: 4, height: 4, extraLoops: 0, branchBias: 0.5 };
    } else if (index <= 3) {
      return { width: 4, height: 4, extraLoops: 1, branchBias: 0.6 };
    } else if (index <= 6) {
      return { width: 5, height: 5, extraLoops: 1, branchBias: 0.5 };
    } else {
      return { width: 5, height: 5, extraLoops: 2, branchBias: 0.7 };
    }
  }

  private startLevel(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
    this.isWon = false;
    this.tapCount = 0;
    this.elapsedTime = 0;
    if (this.timerEvent) this.timerEvent.paused = false;

    const params = this.getLevelParams(levelIndex);
    const seed = 10000 + levelIndex * 7919; // Semilla determinista por nivel
    this.currentLevelData = generateLevel(params, seed);
    this.board = this.currentLevelData.board;

    this.levelText.setText(`Nivel ${levelIndex} (${params.width}×${params.height})`);
    this.diffText.setText(`Dificultad: ${this.currentLevelData.difficulty.toFixed(1)}`);
    this.tapsText.setText('Toques: 0');
    this.timerText.setText('Tiempo: 00:00');

    this.buildBoard();
    this.updateFlowVisuals();
  }

  private createHeader(width: number): void {
    // Título superior
    this.add
      .text(width / 2, 60, APP_NAME, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);

    // Indicador de nivel y dificultad
    this.levelText = this.add
      .text(width / 2, 100, 'Nivel 1 (4×4)', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    this.diffText = this.add
      .text(width / 2, 126, 'Dificultad: 16.0', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    // Contadores en cabecera
    this.tapsText = this.add
      .text(width * 0.22, 165, 'Toques: 0', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.connectedText = this.add
      .text(width * 0.5, 165, '⚡ 0/16', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(width * 0.78, 165, 'Tiempo: 00:00', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    // Botón de reinicio rápido en cabecera
    const resetBtn = this.add
      .text(width / 2, 205, '🔄 Reiniciar nivel', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    resetBtn.on('pointerover', () => resetBtn.setColor(THEME.primaryCss));
    resetBtn.on('pointerout', () => resetBtn.setColor('#64748b'));
    resetBtn.on('pointerdown', () => {
      if (!this.isWon) {
        this.startLevel(this.currentLevelIndex);
      }
    });
  }

  private buildBoard(): void {
    const { width, height } = this.cameras.main;
    this.boardContainer.removeAll(true);
    this.cellViews = [];

    const { rows, cols } = this.board;
    const maxBoardWidth = Math.min(width * 0.9, 620);
    const maxBoardHeight = height * 0.58;
    const cellSize = Math.min(maxBoardWidth / cols, maxBoardHeight / rows);
    const spacing = 6;
    const effectiveCellSize = cellSize - spacing;

    const boardTotalW = cellSize * cols;
    const startX = (width - boardTotalW) / 2 + cellSize / 2;
    const startY = height * 0.54 - (cellSize * rows) / 2 + cellSize / 2;

    for (let r = 0; r < rows; r++) {
      const rowViews: CellView[] = [];
      for (let c = 0; c < cols; c++) {
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const cell = this.board.grid[r][c];

        const container = this.add.container(x, y);

        // Fondo de celda
        const bg = this.add
          .rectangle(0, 0, effectiveCellSize, effectiveCellSize, THEME.surface)
          .setStrokeStyle(cell.isSource ? 3 : 1.5, cell.isSource ? THEME.accent : 0x30363d)
          .setInteractive({ useHandCursor: true });

        // Gráficos de cables
        const wireGraphics = this.add.graphics();

        container.add([bg, wireGraphics]);
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

        bg.on('pointerdown', () => this.handleCellTap(view));

        this.boardContainer.add(container);
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

    // Animación fluida de giro de 90°
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

    this.updateFlowVisuals();
  }

  private updateFlowVisuals(): void {
    const powered = computePowerFlow(this.board);
    const { rows, cols } = this.board;
    const maxBoardWidth = Math.min(this.cameras.main.width * 0.9, 620);
    const maxBoardHeight = this.cameras.main.height * 0.58;
    const cellSize = Math.min(maxBoardWidth / cols, maxBoardHeight / rows);
    const effectiveCellSize = cellSize - 6;
    const half = effectiveCellSize / 2;
    const wireWidth = Math.max(7, effectiveCellSize * 0.12);

    let poweredCount = 0;
    const totalCells = rows * cols;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const view = this.cellViews[r][c];
        const isCellPowered = powered[r][c];
        if (isCellPowered) poweredCount++;

        const g = view.wireGraphics;
        g.clear();

        const mask = view.cell.baseMask;
        const color = isCellPowered ? THEME.primary : THEME.wireOff;
        const centerColor = view.cell.isSource
          ? THEME.accent
          : isCellPowered
            ? THEME.primary
            : THEME.wireOffHub;

        // Si está energizado, dibujar capa sutil de brillo exterior
        if (isCellPowered) {
          g.lineStyle(wireWidth + 4, THEME.primary, 0.25);
          if (hasDirection(mask, Direction.NORTH)) {
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -half); g.strokePath();
          }
          if (hasDirection(mask, Direction.EAST)) {
            g.beginPath(); g.moveTo(0, 0); g.lineTo(half, 0); g.strokePath();
          }
          if (hasDirection(mask, Direction.SOUTH)) {
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, half); g.strokePath();
          }
          if (hasDirection(mask, Direction.WEST)) {
            g.beginPath(); g.moveTo(0, 0); g.lineTo(-half, 0); g.strokePath();
          }
        }

        // Línea principal del cable
        g.lineStyle(wireWidth, color, 1);

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

        const hubRadius = view.cell.isSource ? wireWidth * 1.35 : wireWidth * 0.85;
        g.fillStyle(centerColor, 1);
        g.fillCircle(0, 0, hubRadius);

        if (view.cell.isSource) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeCircle(0, 0, hubRadius + 4);
        }

        view.bg.setStrokeStyle(
          view.cell.isSource ? 3 : 1.5,
          view.cell.isSource
            ? THEME.accent
            : isCellPowered
              ? THEME.primary
              : THEME.borderOff
        );
      }
    }

    if (this.connectedText) {
      this.connectedText.setText(`⚡ ${poweredCount}/${totalCells}`);
      this.connectedText.setColor(poweredCount === totalCells ? '#38f9d7' : THEME.primaryCss);
    }
  }

  private evaluateVictory(): void {
    if (this.isWon) return;

    if (checkVictory(this.board)) {
      this.isWon = true;
      if (this.timerEvent) this.timerEvent.paused = true;
      this.showVictoryModal();
    }
  }

  private showVictoryModal(): void {
    const { width, height } = this.cameras.main;

    const overlay = this.add.container(width / 2, height / 2);
    overlay.setAlpha(0);

    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.85)
      .setInteractive();

    const cardWidth = Math.min(width * 0.85, 480);
    const cardHeight = 380;
    const card = this.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x161b22, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -120, '¡CIRCUITO COMPLETO!', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -75, `Nivel ${this.currentLevelIndex} superado`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const minTaps = this.currentLevelData.minTaps;
    const efficiency = Math.round((minTaps / Math.max(minTaps, this.tapCount)) * 100);

    const statsText = this.add
      .text(
        0,
        0,
        `⏱️ Tiempo: ${this.formatTime(this.elapsedTime)}\n👆 Toques: ${this.tapCount} (Mínimo: ${minTaps})\n🎯 Eficiencia: ${efficiency}%`,
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '18px',
          color: '#e6edf3',
          align: 'center',
          lineSpacing: 8,
        }
      )
      .setOrigin(0.5);

    // Botón "Siguiente nivel"
    const btnWidth = cardWidth * 0.78;
    const btnHeight = 52;
    const nextBtnBg = this.add
      .rectangle(0, 85, btnWidth, btnHeight, THEME.primary)
      .setInteractive({ useHandCursor: true });

    const nextBtnText = this.add
      .text(0, 85, 'Siguiente nivel →', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#0d1117',
      })
      .setOrigin(0.5);

    nextBtnBg.on('pointerover', () => nextBtnBg.setFillStyle(0x38f9d7));
    nextBtnBg.on('pointerout', () => nextBtnBg.setFillStyle(THEME.primary));
    nextBtnBg.on('pointerdown', () => {
      overlay.destroy();
      this.startLevel(this.currentLevelIndex + 1);
    });

    // Botón secundario "Repetir este nivel"
    const replayBtn = this.add
      .text(0, 140, 'Repetir este nivel', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () => replayBtn.setColor('#ffffff'));
    replayBtn.on('pointerout', () => replayBtn.setColor(THEME.mutedText));
    replayBtn.on('pointerdown', () => {
      overlay.destroy();
      this.startLevel(this.currentLevelIndex);
    });

    overlay.add([backdrop, card, title, subtitle, statsText, nextBtnBg, nextBtnText, replayBtn]);

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
