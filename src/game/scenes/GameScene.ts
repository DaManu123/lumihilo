import Phaser from 'phaser';
import { BoardState, CellState, Direction, LevelParams, GeneratedLevel } from '../../core/types';
import {
  computePowerFlow,
  checkVictory,
  rotateCell,
  hasDirection,
  isBranchConnected,
} from '../../core/grid';
import { generateLevel } from '../../core/generator';
import {
  AdaptiveProfile,
  GameMode,
  getLevelParamsForProfile,
  evaluateAndAdapt,
  PerformanceEvaluation,
} from '../../core/adaptive';
import { THEME, setActiveTheme } from '../theme';
import { storage, UserSettings } from '../../services';
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

interface MoveRecord {
  row: number;
  col: number;
}

export class GameScene extends Phaser.Scene {
  private profile!: AdaptiveProfile;
  private settings!: UserSettings;
  private currentLevelIndex = 1;
  private currentLevelData!: GeneratedLevel;
  private board!: BoardState;
  private cellViews: CellView[][] = [];
  private isWon = false;
  private tapCount = 0;
  private elapsedTime = 0;
  private timerEvent?: Phaser.Time.TimerEvent;
  private moveHistory: MoveRecord[] = [];

  // Elementos de UI
  private headerContainer!: Phaser.GameObjects.Container;
  private levelText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tapsText!: Phaser.GameObjects.Text;
  private modeBtnText!: Phaser.GameObjects.Text;
  private themeBtnText!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Container;
  private undoBtnText!: Phaser.GameObjects.Text;
  private boardContainer!: Phaser.GameObjects.Container;
  private tutorialContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Desactivar el menú contextual del navegador para permitir clic derecho
    this.input.mouse?.disableContextMenu();

    // Cargar perfil y configuraciones persistentes
    this.profile = storage.loadProfile();
    this.settings = storage.loadSettings();
    setActiveTheme(this.settings.theme);

    const { width } = this.cameras.main;
    this.cameras.main.setBackgroundColor(THEME.background);

    this.headerContainer = this.add.container(0, 0);
    this.boardContainer = this.add.container(0, 0);

    this.createHeader(width);
    this.createControlsBar(width);
    this.checkAndShowTutorial(width);

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

  private checkAndShowTutorial(width: number): void {
    if (this.settings.hasSeenTutorial) return;

    const { height } = this.cameras.main;
    const bannerH = 70;
    const bannerY = height - 50;

    this.tutorialContainer = this.add.container(width / 2, bannerY);

    const bg = this.add
      .rectangle(0, 0, Math.min(width * 0.94, 600), bannerH, THEME.surface, 0.96)
      .setStrokeStyle(2, THEME.primary);

    const msg = this.add
      .text(
        -50,
        0,
        '💡 Tip: Clic izquierdo / toque para girar.\nClic derecho (PC) o botón ↩️ Deshacer para retroceder.',
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          color: THEME.text,
          lineSpacing: 3,
        }
      )
      .setOrigin(0.5);

    const okBtn = this.add
      .rectangle(Math.min(width * 0.4, 230), 0, 75, 36, THEME.primary)
      .setInteractive({ useHandCursor: true });

    const okText = this.add
      .text(Math.min(width * 0.4, 230), 0, 'OK', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#0d1117',
      })
      .setOrigin(0.5);

    okBtn.on('pointerdown', () => {
      this.settings.hasSeenTutorial = true;
      storage.saveSettings(this.settings);
      this.tutorialContainer?.destroy();
      this.tutorialContainer = undefined;
    });

    this.tutorialContainer.add([bg, msg, okBtn, okText]);
  }

  private startLevel(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
    this.isWon = false;
    this.tapCount = 0;
    this.elapsedTime = 0;
    this.moveHistory = [];
    this.updateUndoButtonState();

    if (this.timerEvent) this.timerEvent.paused = false;

    const params: LevelParams = getLevelParamsForProfile(this.profile);
    const seed = 10000 + levelIndex * 7919;
    this.currentLevelData = generateLevel(params, seed);
    this.board = this.currentLevelData.board;

    this.levelText.setText(
      `Nivel ${levelIndex} (${params.width}×${params.height}) - Tier ${this.profile.currentTier}`
    );
    this.diffText.setText(
      `Dificultad: ${this.currentLevelData.difficulty.toFixed(1)} | Rating: ${this.profile.rating}`
    );
    this.tapsText.setText('Toques: 0');
    this.timerText.setText('Tiempo: 00:00');

    this.buildBoard();
    this.updateFlowVisuals();
  }

  private createHeader(width: number): void {
    this.headerContainer.removeAll(true);

    // Barra superior: Título + Botón de Modo + Botón de Tema
    this.add
      .text(width / 2, 45, APP_NAME, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);

    // Botón selector de Modo (Relajado / Normal / Reto)
    const modeLabel =
      this.profile.mode === 'relaxed'
        ? '🌿 Relajado'
        : this.profile.mode === 'challenge'
          ? '🔥 Reto'
          : '⚡ Normal';

    const modeBtnBg = this.add
      .rectangle(75, 45, 110, 32, THEME.surface)
      .setStrokeStyle(1.5, THEME.borderOff)
      .setInteractive({ useHandCursor: true });

    this.modeBtnText = this.add
      .text(75, 45, modeLabel, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    modeBtnBg.on('pointerdown', () => this.cycleGameMode());

    // Botón de alternancia de Modo Claro / Oscuro
    const themeIcon = this.settings.theme === 'light' ? '☀️ Claro' : '🌙 Oscuro';
    const themeBtnBg = this.add
      .rectangle(width - 65, 45, 95, 32, THEME.surface)
      .setStrokeStyle(1.5, THEME.borderOff)
      .setInteractive({ useHandCursor: true });

    this.themeBtnText = this.add
      .text(width - 65, 45, themeIcon, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    themeBtnBg.on('pointerdown', () => this.toggleTheme());

    // Subtítulo con nivel y rating
    this.levelText = this.add
      .text(width / 2, 85, 'Nivel 1 (4×4)', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    this.diffText = this.add
      .text(width / 2, 110, 'Dificultad: 16.0', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    // Contadores de toques y tiempo
    this.tapsText = this.add
      .text(width * 0.3, 145, 'Toques: 0', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(width * 0.7, 145, 'Tiempo: 00:00', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.headerContainer.add([
      modeBtnBg,
      this.modeBtnText,
      themeBtnBg,
      this.themeBtnText,
      this.levelText,
      this.diffText,
      this.tapsText,
      this.timerText,
    ]);
  }

  private createControlsBar(width: number): void {
    const barY = 180;

    // Botón de Reinicio
    const resetBtn = this.add
      .text(width * 0.35, barY, '🔄 Reiniciar', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    resetBtn.on('pointerover', () => resetBtn.setColor(THEME.primaryCss));
    resetBtn.on('pointerout', () => resetBtn.setColor(THEME.mutedText));
    resetBtn.on('pointerdown', () => {
      if (!this.isWon) {
        this.startLevel(this.currentLevelIndex);
      }
    });

    // Botón accesible de Deshacer (Undo)
    this.undoBtn = this.add.container(width * 0.65, barY);
    const undoBg = this.add
      .rectangle(0, 0, 110, 28, THEME.surface)
      .setStrokeStyle(1.5, THEME.borderOff)
      .setInteractive({ useHandCursor: true });

    this.undoBtnText = this.add
      .text(0, 0, '↩️ Deshacer', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    undoBg.on('pointerdown', () => this.handleUndo());

    this.undoBtn.add([undoBg, this.undoBtnText]);
    this.updateUndoButtonState();
  }

  private updateUndoButtonState(): void {
    if (!this.undoBtnText) return;
    const canUndo = this.moveHistory.length > 0 && !this.isWon;
    this.undoBtnText.setColor(canUndo ? THEME.primaryCss : THEME.mutedText);
    this.undoBtn.setAlpha(canUndo ? 1 : 0.5);
  }

  private cycleGameMode(): void {
    const modes: GameMode[] = ['relaxed', 'normal', 'challenge'];
    const currentIndex = modes.indexOf(this.profile.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    this.profile.mode = nextMode;
    if (nextMode === 'relaxed') this.profile.currentTier = 1;
    if (nextMode === 'normal') this.profile.currentTier = Math.max(2, Math.min(this.profile.currentTier, 6));
    if (nextMode === 'challenge') this.profile.currentTier = Math.max(5, this.profile.currentTier);

    storage.saveProfile(this.profile);

    const modeLabel =
      nextMode === 'relaxed' ? '🌿 Relajado' : nextMode === 'challenge' ? '🔥 Reto' : '⚡ Normal';
    this.modeBtnText.setText(modeLabel);

    this.startLevel(1);
  }

  private toggleTheme(): void {
    const newThemeName = this.settings.theme === 'light' ? 'dark' : 'light';
    this.settings.theme = newThemeName;
    storage.saveSettings(this.settings);

    setActiveTheme(newThemeName);
    this.cameras.main.setBackgroundColor(THEME.background);

    // Recrear header y redibujar tablero
    const { width } = this.cameras.main;
    this.createHeader(width);
    this.createControlsBar(width);
    this.buildBoard();
    this.updateFlowVisuals();
  }

  private buildBoard(): void {
    const { width, height } = this.cameras.main;
    this.boardContainer.removeAll(true);
    this.cellViews = [];

    const { rows, cols } = this.board;
    const maxBoardWidth = Math.min(width * 0.9, 620);
    const maxBoardHeight = height * 0.56;
    const cellSize = Math.min(maxBoardWidth / cols, maxBoardHeight / rows);
    const spacing = 6;
    const effectiveCellSize = cellSize - spacing;

    const boardTotalW = cellSize * cols;
    const startX = (width - boardTotalW) / 2 + cellSize / 2;
    const startY = height * 0.55 - (cellSize * rows) / 2 + cellSize / 2;

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
          .setStrokeStyle(cell.isSource ? 3 : 1.5, cell.isSource ? THEME.accent : THEME.borderOff)
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

        // Soporte tanto para clic izquierdo (+90° CW) como clic derecho (-90° CCW)
        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          const isReverse = pointer.rightButtonDown() || pointer.button === 2;
          this.handleCellTap(view, isReverse);
        });

        this.boardContainer.add(container);
        rowViews.push(view);
      }
      this.cellViews.push(rowViews);
    }
  }

  private handleCellTap(view: CellView, isReverse = false): void {
    if (this.isWon || view.isRotating) return;

    view.isRotating = true;
    this.tapCount++;
    this.tapsText.setText(`Toques: ${this.tapCount}`);

    // Registrar en el historial de deshacer
    this.moveHistory.push({ row: view.row, col: view.col });
    this.updateUndoButtonState();

    // Rotar en el modelo lógico
    const step = isReverse ? -1 : 1;
    rotateCell(this.board, view.row, view.col, step);

    // Animación fluida de giro
    const deltaAngle = isReverse ? -90 : 90;
    const targetAngle = view.container.angle + deltaAngle;

    this.tweens.add({
      targets: view.container,
      angle: targetAngle,
      duration: 170,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
        this.evaluateVictory();
      },
    });

    this.updateFlowVisuals();
  }

  private handleUndo(): void {
    if (this.isWon || this.moveHistory.length === 0) return;

    const lastMove = this.moveHistory.pop()!;
    this.updateUndoButtonState();

    const view = this.cellViews[lastMove.row][lastMove.col];
    if (view.isRotating) return;

    view.isRotating = true;
    // Deshacer revierte rotando en sentido contrario (-1 paso)
    rotateCell(this.board, lastMove.row, lastMove.col, -1);

    const targetAngle = view.container.angle - 90;
    this.tweens.add({
      targets: view.container,
      angle: targetAngle,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
      },
    });

    this.updateFlowVisuals();
  }

  private updateFlowVisuals(): void {
    const powered = computePowerFlow(this.board);
    const { rows, cols } = this.board;
    const maxBoardWidth = Math.min(this.cameras.main.width * 0.9, 620);
    const maxBoardHeight = this.cameras.main.height * 0.56;
    const cellSize = Math.min(maxBoardWidth / cols, maxBoardHeight / rows);
    const effectiveCellSize = cellSize - 6;
    const half = effectiveCellSize / 2;
    const wireWidth = Math.max(7, effectiveCellSize * 0.12);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const view = this.cellViews[r][c];
        const isCellPowered = powered[r][c];
        const g = view.wireGraphics;
        g.clear();

        const mask = view.cell.baseMask;
        const rot = view.cell.rotation;

        const branches = [
          {
            localDir: Direction.NORTH,
            draw: () => {
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(0, -half);
              g.strokePath();
            },
          },
          {
            localDir: Direction.EAST,
            draw: () => {
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(half, 0);
              g.strokePath();
            },
          },
          {
            localDir: Direction.SOUTH,
            draw: () => {
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(0, half);
              g.strokePath();
            },
          },
          {
            localDir: Direction.WEST,
            draw: () => {
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(-half, 0);
              g.strokePath();
            },
          },
        ];

        // Dibujar cada rama del cable
        for (const branch of branches) {
          if (hasDirection(mask, branch.localDir)) {
            const worldDir = ((branch.localDir + rot) % 4) as Direction;
            const isBranchActive =
              isCellPowered && isBranchConnected(this.board, r, c, worldDir);

            if (isBranchActive) {
              // Resplandor exterior de energía
              g.lineStyle(wireWidth + 4, THEME.primary, 0.28);
              branch.draw();
              // Hilo principal iluminado
              g.lineStyle(wireWidth, THEME.primary, 1);
              branch.draw();
            } else {
              // Cable inactivo
              g.lineStyle(wireWidth, THEME.wireOff, 1);
              branch.draw();
            }
          }
        }

        // Núcleo central
        const hubRadius = view.cell.isSource ? wireWidth * 1.35 : wireWidth * 0.85;
        const centerColor = view.cell.isSource
          ? THEME.accent
          : isCellPowered
            ? THEME.primary
            : THEME.wireOffHub;

        g.fillStyle(centerColor, 1);
        g.fillCircle(0, 0, hubRadius);

        if (view.cell.isSource) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeCircle(0, 0, hubRadius + 4);
        }

        view.bg.setFillStyle(THEME.surface);
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
  }

  private evaluateVictory(): void {
    if (this.isWon) return;

    if (checkVictory(this.board)) {
      this.isWon = true;
      if (this.timerEvent) this.timerEvent.paused = true;

      // Evaluar desempeño y adaptar dificultad del jugador
      const minTaps = this.currentLevelData.minTaps;
      const { updatedProfile, evaluation } = evaluateAndAdapt(this.profile, {
        minTaps,
        actualTaps: this.tapCount,
        elapsedSeconds: this.elapsedTime,
      });

      this.profile = updatedProfile;
      storage.saveProfile(this.profile);

      this.showVictoryModal(evaluation);
    }
  }

  private showVictoryModal(evaluation: PerformanceEvaluation): void {
    const { width, height } = this.cameras.main;

    const overlay = this.add.container(width / 2, height / 2);
    overlay.setAlpha(0);

    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.8)
      .setInteractive();

    const cardWidth = Math.min(width * 0.86, 480);
    const cardHeight = 410;
    const card = this.add
      .rectangle(0, 0, cardWidth, cardHeight, THEME.surface, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -145, '¡CIRCUITO COMPLETO!', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '25px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -105, `Nivel ${this.currentLevelIndex} superado`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const minTaps = this.currentLevelData.minTaps;
    const efficiency = Math.round(evaluation.tapEfficiency * 100);

    const deltaSign = evaluation.deltaRating >= 0 ? '+' : '';
    const ratingFeedback = `${deltaSign}${evaluation.deltaRating} Rating (Total: ${this.profile.rating})`;
    const tierFeedback =
      evaluation.newTier !== this.profile.currentTier
        ? `\n🆙 Nivel de habilidad: Tier ${evaluation.newTier}`
        : '';

    const statsText = this.add
      .text(
        0,
        -15,
        `⏱️ Tiempo: ${this.formatTime(this.elapsedTime)}\n` +
          `👆 Toques: ${this.tapCount} (Mínimo: ${minTaps})\n` +
          `🎯 Eficiencia: ${efficiency}%\n` +
          `📈 ${ratingFeedback}${tierFeedback}`,
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '16px',
          color: THEME.text,
          align: 'center',
          lineSpacing: 8,
        }
      )
      .setOrigin(0.5);

    // Botón "Siguiente nivel"
    const btnWidth = cardWidth * 0.78;
    const btnHeight = 50;
    const nextBtnBg = this.add
      .rectangle(0, 95, btnWidth, btnHeight, THEME.primary)
      .setInteractive({ useHandCursor: true });

    const nextBtnText = this.add
      .text(0, 95, 'Siguiente nivel →', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#0d1117',
      })
      .setOrigin(0.5);

    nextBtnBg.on('pointerover', () => nextBtnBg.setFillStyle(THEME.primaryGlow));
    nextBtnBg.on('pointerout', () => nextBtnBg.setFillStyle(THEME.primary));
    nextBtnBg.on('pointerdown', () => {
      overlay.destroy();
      this.startLevel(this.currentLevelIndex + 1);
    });

    // Botón secundario "Repetir nivel"
    const replayBtn = this.add
      .text(0, 150, 'Repetir este nivel', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: THEME.mutedText,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () => replayBtn.setColor(THEME.text));
    replayBtn.on('pointerout', () => replayBtn.setColor(THEME.mutedText));
    replayBtn.on('pointerdown', () => {
      overlay.destroy();
      this.startLevel(this.currentLevelIndex);
    });

    overlay.add([backdrop, card, title, subtitle, statsText, nextBtnBg, nextBtnText, replayBtn]);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 320,
      ease: 'Power2',
    });
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
