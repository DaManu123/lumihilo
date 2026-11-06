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
import {
  HINT_COST,
  PlayerProgress,
  SparksReward,
  applyLevelOutcome,
  computeSparksReward,
  currentStreak,
  dailyParams,
  dailySeed,
  dailyTier,
  dateKey,
  formatSparks,
  isNewTimeRecord,
  levelSeed,
  spendSparks,
} from '../../core/progress';
import { findHintCell, hintRotationDelta } from '../../core/hints';
import { THEME, setActiveTheme } from '../theme';
import {
  FONT,
  FONT_FAMILY,
  MARGIN,
  HudLayout,
  Rect,
  BoardGeometry,
  computeHudLayout,
  computeBoardGeometry,
} from '../layout';
import { storage, UserSettings, RotationDirection } from '../../services';
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
  /** Sentido del giro realizado: +1 horario, -1 antihorario (para poder deshacerlo exactamente). */
  step: number;
}

interface ButtonParts {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface VictoryInfo {
  reward: SparksReward;
  isDaily: boolean;
  firstDailyToday: boolean;
  isNewRecord: boolean;
  streak: number;
  streakIncreased: boolean;
}

const HINT_GOLD = 0xffc933;

export class GameScene extends Phaser.Scene {
  private profile!: AdaptiveProfile;
  private progress!: PlayerProgress;
  private settings!: UserSettings;
  private currentLevelIndex = 1;
  private currentLevelData!: GeneratedLevel;
  private currentParams!: LevelParams;
  private board!: BoardState;
  private geometry!: BoardGeometry;
  private hud!: HudLayout;
  private cellViews: CellView[][] = [];
  private isWon = false;
  private tapCount = 0;
  private hintsUsed = 0;
  private elapsedTime = 0;
  private timerEvent?: Phaser.Time.TimerEvent;
  private moveHistory: MoveRecord[] = [];
  private rotationDirection: RotationDirection = 'cw';

  // Reto diario
  private isDaily = false;
  private dailyKey = '';

  // Contenedores de UI
  private headerContainer!: Phaser.GameObjects.Container;
  private controlsContainer!: Phaser.GameObjects.Container;
  private boardContainer!: Phaser.GameObjects.Container;

  // Elementos de UI
  private levelText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tapsText!: Phaser.GameObjects.Text;
  private sparksText!: Phaser.GameObjects.Text;
  private modeBtn!: ButtonParts;
  private dailyBtn!: ButtonParts;
  private undoBtn!: ButtonParts;
  private hintBtn!: ButtonParts;
  private dirBtn!: Phaser.GameObjects.Container;
  private dirBg!: Phaser.GameObjects.Rectangle;
  private dirIcon!: Phaser.GameObjects.Graphics;
  private dirTitle!: Phaser.GameObjects.Text;
  private dirSub!: Phaser.GameObjects.Text;
  private dirBtnRect!: Rect;
  private toast?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Desactivar el menú contextual del navegador para permitir clic derecho
    this.input.mouse?.disableContextMenu();

    // Cargar perfil, progreso y configuraciones persistentes
    this.profile = storage.loadProfile();
    this.progress = storage.loadProgress();
    this.settings = storage.loadSettings();
    setActiveTheme(this.settings.theme);
    this.rotationDirection = this.settings.rotationDirection === 'ccw' ? 'ccw' : 'cw';
    this.currentLevelIndex = this.progress.currentLevel;

    const { width } = this.cameras.main;
    this.cameras.main.setBackgroundColor(THEME.background);
    this.hud = computeHudLayout(width);

    this.headerContainer = this.add.container(0, 0);
    this.boardContainer = this.add.container(0, 0);
    this.controlsContainer = this.add.container(0, 0);

    // El nivel debe existir antes de construir la interfaz (el HUD lee sus datos)
    this.loadLevel(this.currentLevelIndex);
    this.buildUi();
    this.buildBoard();
    this.updateFlowVisuals();
    this.checkAndShowTutorial();

    // Cronómetro interno (actualiza cada segundo)
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.isWon) {
          this.elapsedTime++;
          this.updateHud();
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Interfaz
  // ---------------------------------------------------------------------------

  /** Construye (o reconstruye, p. ej. al cambiar de tema) toda la interfaz fuera del tablero. */
  private buildUi(): void {
    this.headerContainer.removeAll(true);
    this.controlsContainer.removeAll(true);
    this.createHeader();
    this.createControlsBar();
    this.updateHud();
    this.updateUndoButtonState();
    this.updateHintButtonState();
  }

  /** Crea un botón táctil con fondo, borde y texto centrado (admite varias líneas). */
  private makeButton(
    rect: Rect,
    label: string,
    onTap: () => void,
    opts: { textColor?: string; strokeColor?: number; fontSize?: number } = {}
  ): ButtonParts {
    const container = this.add.container(rect.x, rect.y);
    const bg = this.add
      .rectangle(0, 0, rect.w, rect.h, THEME.surface)
      .setStrokeStyle(2, opts.strokeColor ?? THEME.borderOff)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${opts.fontSize ?? FONT.button}px`,
        fontStyle: 'bold',
        color: opts.textColor ?? THEME.text,
        align: 'center',
      })
      .setOrigin(0.5);

    bg.on('pointerdown', onTap);
    container.add([bg, text]);
    return { container, bg, text };
  }

  private modeLabel(mode: GameMode): string {
    return mode === 'relaxed' ? '🌿 Relajado' : mode === 'challenge' ? '🔥 Reto' : '⚡ Normal';
  }

  private dailyLabel(): string {
    if (this.isDaily) return '🏠 Volver';
    return this.progress.lastDailyCompleted === dateKey(new Date()) ? '📅 Diario ✓' : '📅 Diario';
  }

  private createHeader(): void {
    const { width } = this.cameras.main;

    const title = this.add
      .text(width / 2, this.hud.titleY, APP_NAME, {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.title}px`,
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const statsBtn = this.makeButton(this.hud.statsBtn, '📊', () => this.showStatsModal(), {
      fontSize: 40,
    });

    this.sparksText = this.add
      .text(this.hud.sparksPos.x, this.hud.sparksPos.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.stats}px`,
        fontStyle: 'bold',
        color: THEME.accentCss,
      })
      .setOrigin(1, 0.5);

    // Selector de modo (Relajado / Normal / Reto)
    this.modeBtn = this.makeButton(
      this.hud.modeBtn,
      this.modeLabel(this.profile.mode),
      () => this.cycleGameMode(),
      { textColor: THEME.primaryCss }
    );

    // Reto diario
    this.dailyBtn = this.makeButton(this.hud.dailyBtn, this.dailyLabel(), () => this.toggleDaily(), {
      textColor: THEME.accentCss,
    });

    // Alternancia de modo Claro / Oscuro
    const themeBtn = this.makeButton(
      this.hud.themeBtn,
      this.settings.theme === 'light' ? '☀️ Claro' : '🌙 Oscuro',
      // Se difiere para no destruir el botón mientras se procesa su propio toque
      () => this.time.delayedCall(0, () => this.toggleTheme())
    );

    this.levelText = this.add
      .text(width / 2, this.hud.levelY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.level}px`,
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    this.diffText = this.add
      .text(width / 2, this.hud.diffY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.small}px`,
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.tapsText = this.add
      .text(this.hud.tapsX, this.hud.statsY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.stats}px`,
        color: THEME.text,
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(this.hud.timeX, this.hud.statsY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.stats}px`,
        color: THEME.text,
      })
      .setOrigin(0.5);

    this.headerContainer.add([
      title,
      statsBtn.container,
      this.sparksText,
      this.modeBtn.container,
      this.dailyBtn.container,
      themeBtn.container,
      this.levelText,
      this.diffText,
      this.tapsText,
      this.timerText,
    ]);
  }

  /** Refresca todos los textos informativos a partir del estado actual. */
  private updateHud(): void {
    if (!this.levelText || !this.currentParams) return;
    const { width, height } = this.currentParams;
    this.levelText.setText(
      this.isDaily
        ? `📅 Reto diario (${width}×${height}) · Tier ${dailyTier(this.dailyKey)}`
        : `Nivel ${this.currentLevelIndex} (${width}×${height}) · Tier ${this.profile.currentTier}`
    );
    this.diffText.setText(
      `Dificultad ${this.currentLevelData.difficulty.toFixed(1)} · Rating ${this.profile.rating}`
    );
    this.tapsText.setText(`Toques: ${this.tapCount}`);
    this.timerText.setText(`Tiempo: ${this.formatTime(this.elapsedTime)}`);
    this.sparksText.setText(`✨ ${formatSparks(this.progress.sparks)}`);
  }

  private createControlsBar(): void {
    const resetBtn = this.makeButton(this.hud.resetBtn, '🔄 Reiniciar', () => {
      if (!this.isWon) {
        this.startLevel(this.currentLevelIndex);
      }
    });

    this.undoBtn = this.makeButton(this.hud.undoBtn, '↩️ Deshacer', () => this.handleUndo());

    this.hintBtn = this.makeButton(this.hud.hintBtn, `💡 Pista\n${HINT_COST} ✨`, () => this.useHint(), {
      fontSize: 24,
    });

    this.createDirectionButton(this.hud.dirBtn);

    this.controlsContainer.add([
      resetBtn.container,
      this.undoBtn.container,
      this.hintBtn.container,
      this.dirBtn,
    ]);
  }

  /**
   * Botón grande que indica (y cambia) el sentido en que giran las piezas al tocarlas.
   * La flecha circular apunta siempre hacia donde girarán las piezas; el color también cambia
   * (cian = horario, magenta = antihorario) para no depender solo del icono.
   */
  private createDirectionButton(rect: Rect): void {
    this.dirBtnRect = rect;
    this.dirBtn = this.add.container(rect.x, rect.y);

    this.dirBg = this.add.rectangle(0, 0, rect.w, rect.h, THEME.surface).setInteractive({
      useHandCursor: true,
    });

    this.dirIcon = this.add.graphics();

    this.dirTitle = this.add
      .text(46, -20, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);

    this.dirSub = this.add
      .text(46, 24, 'Toca aquí para cambiar el sentido', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT.small}px`,
        color: THEME.mutedText,
      })
      .setOrigin(0.5);

    this.dirBg.on('pointerdown', () => this.toggleRotationDirection());

    this.dirBtn.add([this.dirBg, this.dirIcon, this.dirTitle, this.dirSub]);
    this.renderDirectionButton();
  }

  private renderDirectionButton(): void {
    const clockwise = this.rotationDirection === 'cw';
    const color = clockwise ? THEME.primary : THEME.accent;
    const colorCss = clockwise ? THEME.primaryCss : THEME.accentCss;

    this.dirBg.setFillStyle(THEME.surface).setStrokeStyle(5, color);
    this.dirTitle.setText(clockwise ? 'GIRO HORARIO' : 'GIRO ANTIHORARIO').setColor(colorCss);

    // Flecha circular: un arco de 270° con punta en el extremo, en el sentido del giro.
    // Para antihorario se refleja horizontalmente (mirror = -1).
    const mirror = clockwise ? 1 : -1;
    const cx = -this.dirBtnRect.w / 2 + 78;
    const cy = 0;
    const radius = 28;
    const start = -Math.PI * 0.55;
    const end = start + Math.PI * 1.5;
    const segments = 28;

    const g = this.dirIcon;
    g.clear();
    g.lineStyle(9, color, 1);
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const theta = start + ((end - start) * i) / segments;
      const x = cx + mirror * radius * Math.cos(theta);
      const y = cy + radius * Math.sin(theta);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();

    const tx = mirror * -Math.sin(end); // tangente (hacia donde avanza el arco)
    const ty = Math.cos(end);
    const nx = mirror * Math.cos(end); // radial
    const ny = Math.sin(end);
    const ex = cx + radius * nx;
    const ey = cy + radius * ny;
    g.fillStyle(color, 1);
    g.fillTriangle(
      ex + tx * 20,
      ey + ty * 20,
      ex + nx * 16,
      ey + ny * 16,
      ex - nx * 16,
      ey - ny * 16
    );
  }

  private toggleRotationDirection(): void {
    this.rotationDirection = this.rotationDirection === 'cw' ? 'ccw' : 'cw';
    this.settings.rotationDirection = this.rotationDirection;
    storage.saveSettings(this.settings);
    this.renderDirectionButton();

    // Pequeño "pulso" de confirmación (sin parpadeos)
    this.tweens.add({
      targets: this.dirBtn,
      scale: 1.04,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private updateUndoButtonState(): void {
    if (!this.undoBtn) return;
    const canUndo = this.moveHistory.length > 0 && !this.isWon;
    this.undoBtn.text.setColor(canUndo ? THEME.primaryCss : THEME.mutedText);
    this.undoBtn.container.setAlpha(canUndo ? 1 : 0.5);
  }

  private updateHintButtonState(): void {
    if (!this.hintBtn) return;
    const canHint = this.progress.sparks >= HINT_COST && !this.isWon;
    this.hintBtn.text.setColor(canHint ? THEME.primaryCss : THEME.mutedText);
    this.hintBtn.container.setAlpha(canHint ? 1 : 0.5);
  }

  /** Aviso breve y no bloqueante sobre el tablero. */
  private showToast(message: string): void {
    this.toast?.destroy();
    const { width } = this.cameras.main;
    const toast = this.add
      .text(width / 2, this.hud.boardTop + 60, message, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: 'bold',
        color: THEME.text,
        backgroundColor: THEME.surfaceCss,
        padding: { x: 28, y: 18 },
        align: 'center',
        wordWrap: { width: width - 2 * MARGIN - 80 },
      })
      .setOrigin(0.5)
      .setDepth(150);
    this.toast = toast;

    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 1500,
      duration: 400,
      onComplete: () => {
        toast.destroy();
        if (this.toast === toast) this.toast = undefined;
      },
    });
  }

  private checkAndShowTutorial(): void {
    if (this.settings.hasSeenTutorial) return;

    const { width, height } = this.cameras.main;
    const cardW = Math.min(width - 2 * MARGIN, 640);
    const cardH = 640;

    const overlay = this.add.container(width / 2, height / 2).setDepth(100);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setInteractive();
    const card = this.add
      .rectangle(0, 0, cardW, cardH, THEME.surface, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -cardH / 2 + 56, '¿Cómo se juega?', {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const body = this.add
      .text(
        0,
        -10,
        '👆 Toca una pieza para girarla.\n' +
          '🔄 El botón grande cambia el sentido: ↻ o ↺.\n' +
          '⚡ Conecta todo el circuito a la fuente.\n' +
          '✨ Gana Chispas y úsalas en 💡 Pistas.\n' +
          '📅 Reto nuevo cada día: ¡cuida tu racha!',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          color: THEME.text,
          align: 'left',
          lineSpacing: 18,
          wordWrap: { width: cardW - 90 },
        }
      )
      .setOrigin(0.5);

    const okBtn = this.makeButton(
      { x: 0, y: cardH / 2 - 76, w: 380, h: 96 },
      'Entendido',
      () => {
        this.settings.hasSeenTutorial = true;
        storage.saveSettings(this.settings);
        overlay.destroy();
      },
      { textColor: '#0d1117', strokeColor: THEME.primary, fontSize: 30 }
    );
    okBtn.bg.setFillStyle(THEME.primary);

    overlay.add([backdrop, card, title, body, okBtn.container]);
  }

  // ---------------------------------------------------------------------------
  // Niveles
  // ---------------------------------------------------------------------------

  /** Genera el nivel y reinicia el estado de la partida (sin tocar la interfaz). */
  private loadLevel(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
    this.isWon = false;
    this.tapCount = 0;
    this.hintsUsed = 0;
    this.elapsedTime = 0;
    this.moveHistory = [];

    if (this.timerEvent) this.timerEvent.paused = false;

    if (this.isDaily) {
      // Mismo puzzle para todos los jugadores del día: no depende de su nivel ni de su perfil
      this.currentParams = dailyParams(this.dailyKey);
      this.currentLevelData = generateLevel(this.currentParams, dailySeed(this.dailyKey));
    } else {
      this.currentParams = getLevelParamsForProfile(this.profile);
      this.currentLevelData = generateLevel(
        this.currentParams,
        levelSeed(this.progress.seedBase, levelIndex)
      );
    }
    this.board = this.currentLevelData.board;
  }

  private startLevel(levelIndex: number): void {
    this.loadLevel(levelIndex);

    // Guardar en qué nivel va el jugador para retomarlo al reabrir la app
    if (!this.isDaily && this.progress.currentLevel !== levelIndex) {
      this.progress = { ...this.progress, currentLevel: levelIndex };
      storage.saveProgress(this.progress);
    }

    this.dailyBtn.text.setText(this.dailyLabel());
    this.updateHud();
    this.updateUndoButtonState();
    this.updateHintButtonState();
    this.buildBoard();
    this.updateFlowVisuals();
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
    this.modeBtn.text.setText(this.modeLabel(nextMode));

    // Cambiar de modo reinicia la progresión de niveles (y sale del reto diario)
    this.isDaily = false;
    this.startLevel(1);
  }

  private toggleDaily(): void {
    if (this.isDaily) {
      this.isDaily = false;
      this.startLevel(this.progress.currentLevel);
    } else {
      this.isDaily = true;
      this.dailyKey = dateKey(new Date());
      this.startLevel(1);
    }
  }

  private toggleTheme(): void {
    const newThemeName = this.settings.theme === 'light' ? 'dark' : 'light';
    this.settings.theme = newThemeName;
    storage.saveSettings(this.settings);

    setActiveTheme(newThemeName);
    this.cameras.main.setBackgroundColor(THEME.background);

    // Reconstruye la interfaz con la nueva paleta conservando el estado de la partida
    this.buildUi();
    this.buildBoard();
    this.updateFlowVisuals();
  }

  private buildBoard(): void {
    const { width, height } = this.cameras.main;
    this.boardContainer.removeAll(true);
    this.cellViews = [];

    const { rows, cols } = this.board;
    this.geometry = computeBoardGeometry(width, height, rows, cols, this.hud.boardTop);
    const { cellSize, cellVisual, startX, startY } = this.geometry;

    for (let r = 0; r < rows; r++) {
      const rowViews: CellView[] = [];
      for (let c = 0; c < cols; c++) {
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const cell = this.board.grid[r][c];

        const container = this.add.container(x, y);

        // Fondo de celda
        const bg = this.add
          .rectangle(0, 0, cellVisual, cellVisual, THEME.surface)
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

        // Toque / clic izquierdo: gira en el sentido elegido; clic derecho (PC): sentido contrario
        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          const isRightClick = pointer.rightButtonDown() || pointer.button === 2;
          this.handleCellTap(view, isRightClick);
        });

        this.boardContainer.add(container);
        rowViews.push(view);
      }
      this.cellViews.push(rowViews);
    }
  }

  /**
   * @param invert true cuando se usa el clic derecho: gira en el sentido contrario al seleccionado.
   */
  private handleCellTap(view: CellView, invert = false): void {
    if (this.isWon || view.isRotating) return;

    // El botón de dirección define el sentido; el clic derecho (PC) lo invierte
    let step = this.rotationDirection === 'cw' ? 1 : -1;
    if (invert) step = -step;

    view.isRotating = true;
    this.tapCount++;
    this.updateHud();

    // Registrar en el historial de deshacer (con el sentido, para revertirlo exactamente)
    this.moveHistory.push({ row: view.row, col: view.col, step });
    this.updateUndoButtonState();

    // Rotar en el modelo lógico
    rotateCell(this.board, view.row, view.col, step);

    // Animación fluida de giro
    const targetAngle = view.container.angle + step * 90;

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

    const lastMove = this.moveHistory[this.moveHistory.length - 1];
    const view = this.cellViews[lastMove.row][lastMove.col];

    // Si la pieza aún está girando se ignora el toque sin perder la jugada del historial
    if (view.isRotating) return;

    this.moveHistory.pop();
    this.updateUndoButtonState();

    view.isRotating = true;
    // Deshacer gira en el sentido contrario al de la jugada original
    rotateCell(this.board, lastMove.row, lastMove.col, -lastMove.step);

    const targetAngle = view.container.angle - lastMove.step * 90;
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

  /**
   * Comodín de alineación: por 10 Chispas, orienta correctamente la pieza mal colocada más
   * cercana a la fuente. Usar pistas cuenta en el ajuste de dificultad y quita el bono de eficiencia.
   */
  private useHint(): void {
    if (this.isWon) return;

    const target = findHintCell(this.board);
    if (!target) {
      this.showToast('¡Todo está bien colocado!');
      return;
    }

    const view = this.cellViews[target.row][target.col];
    if (view.isRotating) return; // espera a que termine el giro; no se cobra

    const afterPurchase = spendSparks(this.progress, HINT_COST);
    if (!afterPurchase) {
      this.showToast(`Necesitas ${HINT_COST} ✨ para una pista.\nResuelve niveles para ganar Chispas.`);
      return;
    }

    this.progress = afterPurchase;
    storage.saveProgress(this.progress);
    this.hintsUsed++;

    // La pista altera el tablero: el historial de deshacer anterior ya no sería coherente
    this.moveHistory = [];
    this.updateUndoButtonState();

    const delta = hintRotationDelta(view.cell.rotation);
    view.isRotating = true;
    rotateCell(this.board, target.row, target.col, delta);

    this.updateHud();
    this.updateHintButtonState();
    this.updateFlowVisuals();
    view.bg.setStrokeStyle(5, HINT_GOLD); // resalta la pieza corregida

    this.tweens.add({
      targets: view.container,
      angle: view.container.angle + delta * 90,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
        view.bg.setStrokeStyle(5, HINT_GOLD);
        this.evaluateVictory();
        // Mantiene el resaltado dorado un instante para que se vea qué pieza se corrigió
        this.time.delayedCall(900, () => {
          if (this.cellViews[target.row]?.[target.col] === view) this.updateFlowVisuals();
        });
      },
    });
  }

  private updateFlowVisuals(): void {
    const powered = computePowerFlow(this.board);
    const { rows, cols } = this.board;
    const half = this.geometry.cellVisual / 2;
    const wireWidth = Math.max(8, this.geometry.cellVisual * 0.12);

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
    if (!checkVictory(this.board)) return;

    this.isWon = true;
    this.updateUndoButtonState();
    this.updateHintButtonState();
    if (this.timerEvent) this.timerEvent.paused = true;

    const today = dateKey(new Date());
    const minTaps = this.currentLevelData.minTaps;
    const playedTier = this.isDaily ? dailyTier(this.dailyKey) : this.profile.currentTier;

    // Evaluar desempeño; el reto diario NO altera el perfil adaptativo (es igual para todos)
    const { updatedProfile, evaluation } = evaluateAndAdapt(this.profile, {
      minTaps,
      actualTaps: this.tapCount,
      elapsedSeconds: this.elapsedTime,
      hintsUsed: this.hintsUsed,
    });
    if (!this.isDaily) {
      this.profile = updatedProfile;
      storage.saveProfile(this.profile);
    }

    // Recompensa de Chispas: el reto diario paga doble la primera vez de cada día y nada al repetirlo
    const countsAsTodaysDaily = this.isDaily && this.dailyKey === today;
    const firstDailyToday = countsAsTodaysDaily && this.progress.lastDailyCompleted !== today;
    const multiplier = this.isDaily ? (firstDailyToday ? 2 : 0) : 1;
    const isNewRecord =
      this.hintsUsed === 0 && isNewTimeRecord(this.progress, playedTier, this.elapsedTime);

    const reward = computeSparksReward({
      tier: playedTier,
      tapEfficiency: evaluation.tapEfficiency,
      elapsedSeconds: this.elapsedTime,
      minTaps,
      hintsUsed: this.hintsUsed,
      isNewRecord,
      multiplier,
    });

    const streakBefore = this.progress.streak.current;
    this.progress = applyLevelOutcome(this.progress, {
      tier: playedTier,
      elapsedSeconds: this.elapsedTime,
      tapEfficiency: evaluation.tapEfficiency,
      sparksEarned: reward.total,
      hintsUsed: this.hintsUsed,
      isDaily: countsAsTodaysDaily,
      today,
    });
    if (!this.isDaily) {
      // Al ganar, el jugador retoma en el siguiente nivel si cierra la app
      this.progress = { ...this.progress, currentLevel: this.currentLevelIndex + 1 };
    }
    storage.saveProgress(this.progress);
    this.updateHud();

    this.showVictoryModal(evaluation, {
      reward,
      isDaily: this.isDaily,
      firstDailyToday,
      isNewRecord,
      streak: currentStreak(this.progress.streak, today),
      streakIncreased: this.progress.streak.current > streakBefore,
    });
  }

  private showVictoryModal(evaluation: PerformanceEvaluation, info: VictoryInfo): void {
    const { width, height } = this.cameras.main;

    const overlay = this.add.container(width / 2, height / 2).setDepth(200);
    overlay.setAlpha(0);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setInteractive();

    const cardWidth = Math.min(width - 2 * MARGIN, 640);
    const cardHeight = 860;
    const card = this.add
      .rectangle(0, 0, cardWidth, cardHeight, THEME.surface, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -cardHeight / 2 + 56, '¡CIRCUITO COMPLETO!', {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(
        0,
        -cardHeight / 2 + 108,
        info.isDaily ? '📅 Reto diario superado' : `Nivel ${this.currentLevelIndex} superado`,
        { fontFamily: FONT_FAMILY, fontSize: '28px', color: THEME.text }
      )
      .setOrigin(0.5);

    const minTaps = this.currentLevelData.minTaps;
    const efficiency = Math.round(evaluation.tapEfficiency * 100);
    const { reward } = info;

    const lines: string[] = [
      `⏱️ Tiempo: ${this.formatTime(this.elapsedTime)}${info.isNewRecord ? '  🏅 ¡Récord!' : ''}`,
      `👆 Toques: ${this.tapCount} (Mínimo: ${minTaps})`,
      this.hintsUsed > 0 ? '🎯 Eficiencia: — (con pistas)' : `🎯 Eficiencia: ${efficiency}%`,
    ];
    if (this.hintsUsed > 0) lines.push(`💡 Pistas usadas: ${this.hintsUsed}`);

    if (!info.isDaily) {
      const deltaSign = evaluation.deltaRating >= 0 ? '+' : '';
      lines.push(`📈 ${deltaSign}${evaluation.deltaRating} Rating (Total: ${this.profile.rating})`);
      if (evaluation.newTier !== this.profile.currentTier) {
        lines.push(`🆙 Nivel de habilidad: Tier ${evaluation.newTier}`);
      }
    }

    if (info.isDaily && !info.firstDailyToday) {
      lines.push('✨ Sin Chispas: ya completaste el reto de hoy');
    } else {
      lines.push(`✨ +${reward.total} Chispas${reward.multiplier === 2 ? '  (¡doble por el reto!)' : ''}`);
    }
    if (info.streak > 0) {
      lines.push(`🔥 Racha: ${info.streak} ${info.streak === 1 ? 'día' : 'días'}${info.streakIncreased ? ' ¡sube!' : ''}`);
    }

    const statsText = this.add
      .text(0, -90, lines.join('\n'), {
        fontFamily: FONT_FAMILY,
        fontSize: '27px',
        color: THEME.text,
        align: 'center',
        lineSpacing: 12,
        wordWrap: { width: cardWidth - 60 },
      })
      .setOrigin(0.5);

    const breakdown =
      reward.total > 0
        ? `Base ${reward.base} · Eficiencia +${reward.efficiencyBonus} · Rapidez +${reward.speedBonus} · Récord +${reward.recordBonus}`
        : '';
    const breakdownText = this.add
      .text(0, cardHeight / 2 - 280, breakdown, {
        fontFamily: FONT_FAMILY,
        fontSize: '21px',
        color: THEME.mutedText,
        align: 'center',
        wordWrap: { width: cardWidth - 60 },
      })
      .setOrigin(0.5);

    // Botón principal: siguiente nivel, o volver al juego si venía del reto diario
    const nextBtn = this.makeButton(
      { x: 0, y: cardHeight / 2 - 190, w: cardWidth * 0.84, h: 104 },
      info.isDaily ? 'Volver al juego →' : 'Siguiente nivel →',
      () => {
        overlay.destroy();
        if (info.isDaily) {
          this.isDaily = false;
          this.startLevel(this.progress.currentLevel);
        } else {
          this.startLevel(this.currentLevelIndex + 1);
        }
      },
      { textColor: '#0d1117', strokeColor: THEME.primary, fontSize: 32 }
    );
    nextBtn.bg.setFillStyle(THEME.primary);

    // Botón secundario "Repetir nivel"
    const replayBtn = this.makeButton(
      { x: 0, y: cardHeight / 2 - 70, w: cardWidth * 0.84, h: 92 },
      info.isDaily ? 'Repetir el reto' : 'Repetir este nivel',
      () => {
        overlay.destroy();
        this.startLevel(this.currentLevelIndex);
      }
    );

    overlay.add([
      backdrop,
      card,
      title,
      subtitle,
      statsText,
      breakdownText,
      nextBtn.container,
      replayBtn.container,
    ]);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 320,
      ease: 'Power2',
    });
  }

  /** Pantalla de estadísticas del jugador. */
  private showStatsModal(): void {
    const { width, height } = this.cameras.main;
    const today = dateKey(new Date());
    const { stats, streak } = this.progress;
    const tier = this.profile.currentTier;
    const best = stats.bestTimeByTier[String(tier)];

    const overlay = this.add.container(width / 2, height / 2).setDepth(200);
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setInteractive();
    const cardW = Math.min(width - 2 * MARGIN, 640);
    const cardH = 700;
    const card = this.add
      .rectangle(0, 0, cardW, cardH, THEME.surface, 1)
      .setStrokeStyle(3, THEME.primary);

    const title = this.add
      .text(0, -cardH / 2 + 56, '📊 Estadísticas', {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: THEME.primaryCss,
      })
      .setOrigin(0.5);

    const body = this.add
      .text(
        0,
        -20,
        `✨ Chispas: ${this.progress.sparks}\n` +
          `🔥 Racha: ${currentStreak(streak, today)} días (mejor: ${streak.best})\n` +
          `🧩 Niveles resueltos: ${stats.levelsSolved}\n` +
          `🎯 Con eficiencia perfecta: ${stats.perfectSolves}\n` +
          `📅 Retos diarios completados: ${stats.dailyCompleted}\n` +
          `⏱️ Mejor tiempo (Tier ${tier}): ${best !== undefined ? this.formatTime(best) : '—'}\n` +
          `📈 Rating: ${this.profile.rating}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          color: THEME.text,
          align: 'left',
          lineSpacing: 20,
        }
      )
      .setOrigin(0.5);

    const closeBtn = this.makeButton(
      { x: 0, y: cardH / 2 - 76, w: 380, h: 96 },
      'Cerrar',
      () => overlay.destroy(),
      { textColor: '#0d1117', strokeColor: THEME.primary, fontSize: 30 }
    );
    closeBtn.bg.setFillStyle(THEME.primary);

    overlay.add([backdrop, card, title, body, closeBtn.container]);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
