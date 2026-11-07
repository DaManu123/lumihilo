import Phaser from 'phaser';
import { BoardState, CellState, Direction, DIRECTION_DELTAS, LevelParams, GeneratedLevel } from '../../core/types';
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
import { mixColors, toCss } from '../color';
import { IconKind, drawArrowCircle, drawIcon } from '../icons';
import {
  FONT,
  FONT_DISPLAY,
  FONT_UI,
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
  g: Phaser.GameObjects.Graphics;
  cell: CellState;
  row: number;
  col: number;
  isRotating: boolean;
  /** 0 a 1: intensidad extra de brillo durante el pulso de victoria. */
  glow: number;
  /** Anillo de resalte de la pista. */
  hintRing: boolean;
}

interface MoveRecord {
  row: number;
  col: number;
  /** Sentido del giro realizado: +1 horario, -1 antihorario (para poder deshacerlo exactamente). */
  step: number;
}

/** Segmento táctil dentro de una barra: icono + etiqueta (+ línea secundaria opcional). */
interface Segment {
  rect: Rect;
  icon: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  subIcon: Phaser.GameObjects.Graphics;
}

interface SegmentState {
  label: string;
  kind?: IconKind;
  sub?: string;
  subIcon?: IconKind;
  iconColor?: number;
  labelColor?: string;
}

interface VictoryInfo {
  reward: SparksReward;
  isDaily: boolean;
  firstDailyToday: boolean;
  isNewRecord: boolean;
  streak: number;
  streakIncreased: boolean;
  difficultyChange: 'up' | 'down' | null;
}

interface TextOptions {
  size?: number;
  color?: string;
  weight?: string;
  display?: boolean;
  originX?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

/** Retraso entre casillas consecutivas en el pulso de luz de la victoria. */
const PULSE_STEP_MS = 55;

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
  private levelChip!: Phaser.GameObjects.Graphics;
  private levelChipText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tapsText!: Phaser.GameObjects.Text;
  private sparksText!: Phaser.GameObjects.Text;
  private sparksIcon!: Phaser.GameObjects.Graphics;
  private modeSeg!: Segment;
  private dailySeg!: Segment;
  private themeSeg!: Segment;
  private undoSeg!: Segment;
  private hintSeg!: Segment;
  private dirBtn!: Phaser.GameObjects.Container;
  private dirPanel!: Phaser.GameObjects.Graphics;
  private dirIcon!: Phaser.GameObjects.Graphics;
  private dirTitle!: Phaser.GameObjects.Text;
  private dirRect!: Rect;
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
    this.applyBackground();
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

  /** Aplica el color de fondo del tema al lienzo y a la página (visible fuera del lienzo en escritorio). */
  private applyBackground(): void {
    this.cameras.main.setBackgroundColor(THEME.background);
    document.documentElement.style.backgroundColor = toCss(THEME.background);
    document.body.style.backgroundColor = toCss(THEME.background);
  }

  /** Respeta la preferencia del sistema de reducir el movimiento. */
  private reducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------------------------------------------------------------------------
  // Interfaz: piezas reutilizables
  // ---------------------------------------------------------------------------

  /** Construye (o reconstruye, p. ej. al cambiar de tema) toda la interfaz fuera del tablero. */
  private buildUi(): void {
    this.headerContainer.removeAll(true);
    this.controlsContainer.removeAll(true);
    this.createHeader();
    this.createControls();
    this.updateHud();
    this.updateUndoButtonState();
    this.updateHintButtonState();
  }

  private uiText(x: number, y: number, text: string, opts: TextOptions = {}): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: opts.display ? FONT_DISPLAY : FONT_UI,
        fontSize: `${opts.size ?? FONT.button}px`,
        fontStyle: opts.weight ?? (opts.display ? '700' : '600'),
        color: opts.color ?? THEME.text,
        align: opts.align ?? 'left',
        wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
      })
      .setOrigin(opts.originX ?? 0, 0.5);
  }

  /** Panel de vidrio redondeado centrado en `rect`. */
  private glassPanel(rect: Rect, radius: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(THEME.surface, 1);
    g.fillRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, radius);
    g.lineStyle(2, THEME.divider, 1);
    g.strokeRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, radius);
    return g;
  }

  /** Zona táctil invisible. */
  private hitZone(rect: Rect, onTap: () => void): Phaser.GameObjects.Zone {
    const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onTap);
    return zone;
  }

  /** Barra segmentada: un solo panel de vidrio dividido en tres zonas táctiles. */
  private createSegmentedBar(
    parent: Phaser.GameObjects.Container,
    bar: Rect,
    segments: [Rect, Rect, Rect],
    taps: [() => void, () => void, () => void]
  ): [Segment, Segment, Segment] {
    parent.add(this.glassPanel(bar, 26));

    const dividers = this.add.graphics();
    dividers.lineStyle(2, THEME.divider, 1);
    for (const seg of segments.slice(1)) {
      const x = seg.x - seg.w / 2;
      dividers.beginPath();
      dividers.moveTo(x, bar.y - bar.h / 2 + 22);
      dividers.lineTo(x, bar.y + bar.h / 2 - 22);
      dividers.strokePath();
    }
    parent.add(dividers);

    const built = segments.map((rect, i): Segment => {
      const seg: Segment = {
        rect,
        icon: this.add.graphics(),
        label: this.uiText(0, rect.y, '', { size: FONT.button }),
        sub: this.uiText(0, rect.y, '', { size: FONT.small, weight: '500', color: THEME.mutedText }),
        subIcon: this.add.graphics(),
      };
      parent.add([seg.icon, seg.label, seg.sub, seg.subIcon, this.hitZone(rect, taps[i])]);
      return seg;
    });
    return built as [Segment, Segment, Segment];
  }

  /** Dibuja el contenido de un segmento: icono a la izquierda y texto (una o dos líneas) a su derecha. */
  private setSegment(seg: Segment, state: SegmentState): void {
    const { rect } = seg;
    const iconSize = 40;
    const gap = 14;
    const hasSub = state.sub !== undefined;
    const iconColor = state.iconColor ?? THEME.primary;

    seg.label.setText(state.label).setColor(state.labelColor ?? THEME.text);
    seg.sub.setText(state.sub ?? '');

    const subIconSize = state.subIcon ? 24 : 0;
    const subOffset = state.subIcon ? subIconSize + 8 : 0;
    const textW = Math.max(seg.label.width, hasSub ? seg.sub.width + subOffset : 0);
    const total = (state.kind ? iconSize + gap : 0) + textW;
    let x = rect.x - total / 2;

    seg.icon.clear();
    if (state.kind) {
      drawIcon(seg.icon, state.kind, x + iconSize / 2, rect.y, iconSize, iconColor, THEME.surface);
      x += iconSize + gap;
    }

    seg.label.setPosition(x, hasSub ? rect.y - 14 : rect.y);
    seg.sub.setPosition(x + subOffset, rect.y + 20);
    seg.subIcon.clear();
    if (state.subIcon) {
      drawIcon(seg.subIcon, state.subIcon, x + subIconSize / 2, rect.y + 20, subIconSize, THEME.primary, THEME.surface);
    }
  }

  private modeLabel(mode: GameMode): string {
    return mode === 'relaxed' ? 'Relajado' : mode === 'challenge' ? 'Reto' : 'Normal';
  }

  // ---------------------------------------------------------------------------
  // Encabezado
  // ---------------------------------------------------------------------------

  private createHeader(): void {
    const h = this.headerContainer;
    const { titlePos, statsBtn } = this.hud;

    // Fila 1: título a la izquierda; Chispas y estadísticas a la derecha
    const title = this.uiText(titlePos.x, titlePos.y, APP_NAME, { size: FONT.title, display: true });

    const statsIcon = this.add.graphics();
    drawIcon(statsIcon, 'stats', statsBtn.x, statsBtn.y, 42, THEME.primary);
    h.add([
      this.glassPanel(statsBtn, 24),
      title,
      statsIcon,
      this.hitZone(statsBtn, () => this.showStatsModal()),
    ]);

    this.sparksText = this.uiText(this.hud.sparksRight.x, this.hud.sparksRight.y, '', {
      size: FONT.stats,
      display: true,
      color: THEME.primaryCss,
      originX: 1,
    });
    this.sparksIcon = this.add.graphics();
    h.add([this.sparksIcon, this.sparksText]);

    // Información de la partida
    this.levelText = this.uiText(this.hud.levelPos.x, this.hud.levelPos.y, '', { size: FONT.display, display: true });
    this.levelChip = this.add.graphics();
    this.levelChipText = this.uiText(0, this.hud.levelPos.y, '', { size: FONT.small, weight: '700', color: THEME.mutedText });
    this.timerText = this.uiText(this.hud.timePos.x, this.hud.timePos.y, '', { size: FONT.display, display: true, originX: 1 });
    this.tapsText = this.uiText(this.hud.tapsPos.x, this.hud.tapsPos.y, '', {
      size: FONT.small,
      display: true,
      weight: '500',
      color: THEME.mutedText,
      originX: 1,
    });
    h.add([this.levelChip, this.levelText, this.levelChipText, this.timerText, this.tapsText]);
  }

  /** Refresca todos los textos informativos a partir del estado actual. */
  private updateHud(): void {
    if (!this.levelText || !this.currentParams) return;
    const { width, height } = this.currentParams;

    this.levelText.setText(this.isDaily ? 'Reto diario' : `Nivel ${this.currentLevelIndex}`);
    this.timerText.setText(this.formatTime(this.elapsedTime));
    this.tapsText.setText(`${this.tapCount} ${this.tapCount === 1 ? 'toque' : 'toques'}`);

    // Etiqueta con el tamaño del tablero, junto al nombre del nivel
    this.levelChipText.setText(`${width}×${height}`);
    const chipW = this.levelChipText.width + 32;
    const chipH = 46;
    const chipX = this.hud.levelPos.x + this.levelText.width + 18;
    const chipY = this.hud.levelPos.y;
    this.levelChip.clear();
    this.levelChip.lineStyle(2, THEME.divider, 1);
    this.levelChip.strokeRoundedRect(chipX, chipY - chipH / 2, chipW, chipH, chipH / 2);
    this.levelChipText.setPosition(chipX + 16, chipY);

    // Chispas: número a la derecha con un icono de chispa a su izquierda
    this.sparksText.setText(formatSparks(this.progress.sparks));
    this.sparksIcon.clear();
    drawIcon(
      this.sparksIcon,
      'spark',
      this.hud.sparksRight.x - this.sparksText.width - 26,
      this.hud.sparksRight.y,
      32,
      THEME.primary
    );

    this.refreshModeBar();
  }

  private refreshModeBar(): void {
    if (!this.modeSeg) return;
    const dailyDone = this.progress.lastDailyCompleted === dateKey(new Date());

    this.setSegment(this.modeSeg, { label: this.modeLabel(this.profile.mode), sub: 'Modo' });
    this.setSegment(
      this.dailySeg,
      this.isDaily
        ? { label: 'Volver', kind: 'home', sub: 'al juego' }
        : { label: 'Diario', kind: 'calendar', sub: dailyDone ? 'hecho hoy' : 'reto de hoy' }
    );
    this.setSegment(this.themeSeg, {
      label: this.settings.theme === 'light' ? 'Claro' : 'Oscuro',
      kind: this.settings.theme === 'light' ? 'sun' : 'moon',
      sub: 'Tema',
    });
  }

  // ---------------------------------------------------------------------------
  // Controles
  // ---------------------------------------------------------------------------

  private createControls(): void {
    const c = this.controlsContainer;

    // Barra de modo / reto diario / tema
    const [mode, daily, theme] = this.createSegmentedBar(c, this.hud.modeBar, this.hud.modeSegments, [
      () => this.cycleGameMode(),
      () => this.toggleDaily(),
      // Se difiere para no destruir el botón mientras se procesa su propio toque
      () => this.time.delayedCall(0, () => this.toggleTheme()),
    ]);
    this.modeSeg = mode;
    this.dailySeg = daily;
    this.themeSeg = theme;

    // Barra de reiniciar / deshacer / pista
    const [reset, undo, hint] = this.createSegmentedBar(c, this.hud.toolbar, this.hud.toolSegments, [
      () => {
        if (!this.isWon) this.startLevel(this.currentLevelIndex);
      },
      () => this.handleUndo(),
      () => this.useHint(),
    ]);
    this.undoSeg = undo;
    this.hintSeg = hint;
    this.setSegment(reset, { label: 'Reiniciar', kind: 'reset' });

    this.createDirectionButton(this.hud.dirBtn);
    c.add(this.dirBtn);
  }

  /**
   * Botón grande que indica (y cambia) el sentido en que giran las piezas al tocarlas.
   * Es el único control con velo de color: la flecha apunta hacia donde girarán las piezas y el
   * color cambia con el sentido (hielo = horario, lavanda o magenta = antihorario).
   */
  private createDirectionButton(rect: Rect): void {
    this.dirRect = rect;
    this.dirBtn = this.add.container(rect.x, rect.y);

    this.dirPanel = this.add.graphics();
    this.dirIcon = this.add.graphics();
    this.dirTitle = this.uiText(40, -20, '', { size: 32, display: true, originX: 0.5 });
    const sub = this.uiText(40, 26, 'Toca para cambiar el sentido', {
      size: FONT.small,
      weight: '500',
      color: THEME.mutedText,
      originX: 0.5,
    });
    const zone = this.add.zone(0, 0, rect.w, rect.h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.toggleRotationDirection());

    this.dirBtn.add([this.dirPanel, this.dirIcon, this.dirTitle, sub, zone]);
    this.renderDirectionButton();
  }

  private renderDirectionButton(): void {
    const clockwise = this.rotationDirection === 'cw';
    const color = clockwise ? THEME.clockwise : THEME.counterClockwise;
    const colorCss = clockwise ? THEME.clockwiseCss : THEME.counterClockwiseCss;
    const { w, h } = this.dirRect;

    // Vidrio con un velo del color del sentido actual
    this.dirPanel.clear();
    this.dirPanel.fillStyle(mixColors(THEME.surface, color, 0.12), 1);
    this.dirPanel.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
    this.dirPanel.lineStyle(4, color, 1);
    this.dirPanel.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);

    this.dirTitle.setText(clockwise ? 'Giro horario' : 'Giro antihorario').setColor(colorCss);

    this.dirIcon.clear();
    drawArrowCircle(this.dirIcon, -w / 2 + 84, 0, 28, color, 9, clockwise ? 1 : -1);
  }

  private toggleRotationDirection(): void {
    this.rotationDirection = this.rotationDirection === 'cw' ? 'ccw' : 'cw';
    this.settings.rotationDirection = this.rotationDirection;
    storage.saveSettings(this.settings);
    this.renderDirectionButton();

    if (!this.reducedMotion()) {
      // Pequeño "pulso" de confirmación (sin parpadeos)
      this.tweens.add({ targets: this.dirBtn, scale: 1.04, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    }
  }

  private updateUndoButtonState(): void {
    if (!this.undoSeg) return;
    const canUndo = this.moveHistory.length > 0 && !this.isWon;
    this.setSegment(this.undoSeg, {
      label: 'Deshacer',
      kind: 'undo',
      iconColor: canUndo ? THEME.primary : THEME.wireOff,
      labelColor: canUndo ? THEME.text : THEME.mutedText,
    });
  }

  private updateHintButtonState(): void {
    if (!this.hintSeg) return;
    const canHint = this.progress.sparks >= HINT_COST && !this.isWon;
    this.setSegment(this.hintSeg, {
      label: 'Pista',
      kind: 'bulb',
      sub: String(HINT_COST),
      subIcon: 'spark',
      iconColor: canHint ? THEME.primary : THEME.wireOff,
      labelColor: canHint ? THEME.text : THEME.mutedText,
    });
  }

  /** Aviso breve y no bloqueante sobre el tablero. */
  private showToast(message: string): void {
    this.toast?.destroy();
    const { width } = this.cameras.main;
    const toast = this.add
      .text(width / 2, this.hud.boardTop + 70, message, {
        fontFamily: FONT_UI,
        fontSize: '28px',
        fontStyle: '600',
        color: THEME.text,
        backgroundColor: THEME.surfaceCss,
        padding: { x: 30, y: 20 },
        align: 'center',
        wordWrap: { width: width - 2 * MARGIN - 100 },
      })
      .setOrigin(0.5)
      .setDepth(150);
    this.toast = toast;

    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        toast.destroy();
        if (this.toast === toast) this.toast = undefined;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Tarjetas modales (tutorial, estadísticas, victoria)
  // ---------------------------------------------------------------------------

  /** Crea una tarjeta modal con fondo atenuado. Devuelve el contenedor y el ancho de la tarjeta. */
  private createCard(cardH: number, depth: number): { overlay: Phaser.GameObjects.Container; w: number } {
    const { width, height } = this.cameras.main;
    const w = Math.min(width - 2 * MARGIN, 648);
    const overlay = this.add.container(width / 2, height / 2).setDepth(depth);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setInteractive();
    const card = this.add.graphics();
    card.fillStyle(THEME.surface, 1);
    card.fillRoundedRect(-w / 2, -cardH / 2, w, cardH, 34);
    card.lineStyle(3, THEME.cardBorder, 1);
    card.strokeRoundedRect(-w / 2, -cardH / 2, w, cardH, 34);
    overlay.add([backdrop, card]);
    return { overlay, w };
  }

  /** Fila "etiqueta ... valor" con una línea divisoria debajo. */
  private addRow(
    overlay: Phaser.GameObjects.Container,
    cardW: number,
    y: number,
    label: string,
    value: string,
    opts: { valueColor?: string; icon?: IconKind; last?: boolean } = {}
  ): void {
    const left = -cardW / 2 + 44;
    const right = cardW / 2 - 44;
    const labelText = this.uiText(left, y, label, { size: 28, weight: '500', color: THEME.mutedText });
    const valueText = this.uiText(right, y, value, {
      size: 26,
      display: true,
      weight: '600',
      color: opts.valueColor ?? THEME.text,
      originX: 1,
    });
    overlay.add([labelText, valueText]);

    if (opts.icon) {
      const icon = this.add.graphics();
      drawIcon(icon, opts.icon, right - valueText.width - 26, y, 30, THEME.primary, THEME.surface);
      overlay.add(icon);
    }
    if (!opts.last) {
      const line = this.add.graphics();
      line.lineStyle(2, THEME.divider, 1);
      line.beginPath();
      line.moveTo(left, y + 26);
      line.lineTo(right, y + 26);
      line.strokePath();
      overlay.add(line);
    }
  }

  /** Botón relleno (acción principal) o con contorno (secundaria) dentro de una tarjeta. */
  private addCardButton(
    overlay: Phaser.GameObjects.Container,
    rect: Rect,
    label: string,
    onTap: () => void,
    primary: boolean
  ): void {
    const g = this.add.graphics();
    if (primary) {
      g.fillStyle(THEME.primary, 1);
      g.fillRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, 26);
    } else {
      g.lineStyle(2, THEME.cardBorder, 1);
      g.strokeRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, 26);
    }
    const text = this.uiText(rect.x, rect.y, label, {
      size: primary ? 32 : FONT.button,
      display: primary,
      weight: primary ? '700' : '600',
      color: primary ? THEME.onPrimary : THEME.text,
      originX: 0.5,
    });
    overlay.add([g, text, this.hitZone(rect, onTap)]);
  }

  private checkAndShowTutorial(): void {
    if (this.settings.hasSeenTutorial) return;

    const cardH = 700;
    const { overlay, w } = this.createCard(cardH, 100);

    overlay.add(this.uiText(0, -cardH / 2 + 70, 'Cómo se juega', { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    const lines = [
      'Toca una pieza para girarla.',
      'El botón grande cambia el sentido del giro.',
      'Conecta todo el circuito a la fuente.',
      'Gana Chispas y úsalas en las pistas.',
      'Cada día hay un reto nuevo. Cuida tu racha.',
    ];
    let y = -cardH / 2 + 160;
    for (const line of lines) {
      const bullet = this.add.graphics();
      bullet.fillStyle(THEME.primary, 1);
      bullet.fillCircle(-w / 2 + 56, y + 17, 7);
      const text = this.uiText(-w / 2 + 84, y, line, { size: 29, weight: '500', wrap: w - 140 });
      text.setOrigin(0, 0);
      overlay.add([bullet, text]);
      y += text.height + 30;
    }

    this.addCardButton(
      overlay,
      { x: 0, y: cardH / 2 - 84, w: w - 88, h: 100 },
      'Entendido',
      () => {
        this.settings.hasSeenTutorial = true;
        storage.saveSettings(this.settings);
        overlay.destroy();
      },
      true
    );
  }

  /** Pantalla de estadísticas del jugador. */
  private showStatsModal(): void {
    const today = dateKey(new Date());
    const { stats, streak } = this.progress;
    const tier = this.profile.currentTier;
    const best = stats.bestTimeByTier[String(tier)];
    const shownStreak = currentStreak(streak, today);

    const cardH = 860;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.add(this.uiText(0, -cardH / 2 + 70, 'Estadísticas', { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    const days = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
    const rows: Array<[string, string, IconKind?]> = [
      ['Chispas', String(this.progress.sparks), 'spark'],
      ['Racha actual', days(shownStreak)],
      ['Mejor racha', days(streak.best)],
      ['Niveles resueltos', String(stats.levelsSolved)],
      ['Sin pistas y sin fallos', String(stats.perfectSolves)],
      ['Retos diarios', String(stats.dailyCompleted)],
      [`Mejor tiempo (habilidad ${tier})`, best !== undefined ? this.formatTime(best) : '—'],
      ['Nivel de habilidad', String(tier)],
      ['Puntuación', String(this.profile.rating)],
    ];
    let y = -cardH / 2 + 160;
    rows.forEach(([label, value, icon], i) => {
      this.addRow(overlay, w, y, label, value, { icon, last: i === rows.length - 1 });
      y += 58;
    });

    this.addCardButton(overlay, { x: 0, y: cardH / 2 - 84, w: w - 88, h: 100 }, 'Cerrar', () => overlay.destroy(), true);
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
    this.applyBackground();

    // Reconstruye la interfaz con la nueva paleta conservando el estado de la partida
    this.buildUi();
    this.buildBoard();
    this.updateFlowVisuals();
  }

  // ---------------------------------------------------------------------------
  // Tablero
  // ---------------------------------------------------------------------------

  private buildBoard(): void {
    const { width, height } = this.cameras.main;
    this.boardContainer.removeAll(true);
    this.cellViews = [];

    const { rows, cols } = this.board;
    this.geometry = computeBoardGeometry(width, height, rows, cols, this.hud.boardTop);
    const { cellSize, startX, startY } = this.geometry;

    for (let r = 0; r < rows; r++) {
      const rowViews: CellView[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = this.board.grid[r][c];
        const container = this.add.container(startX + c * cellSize, startY + r * cellSize);

        // La zona táctil ocupa toda la celda (incluido el hueco entre casillas)
        const hit = this.add.zone(0, 0, cellSize, cellSize).setInteractive({ useHandCursor: true });
        const g = this.add.graphics();

        container.add([g, hit]);
        container.setAngle(cell.rotation * 90);

        const view: CellView = { container, g, cell, row: r, col: c, isRotating: false, glow: 0, hintRing: false };

        // Toque / clic izquierdo: gira en el sentido elegido; clic derecho (PC): sentido contrario
        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
   * Dibuja una casilla: vidrio redondeado, trazas apagadas (finas) o filamento encendido (grueso,
   * con halo y núcleo blanco-caliente). Todo es simétrico a 90°, así que gira con el contenedor.
   */
  private drawCell(view: CellView, powered: boolean): void {
    const { cellVisual, gap } = this.geometry;
    const half = cellVisual / 2;
    const radius = cellVisual * 0.17;
    const g = view.g;
    const glow = view.glow;
    const isSource = view.cell.isSource;
    g.clear();

    // Casilla de vidrio: se tiñe de calor cuando está energizada
    const tint = powered ? 0.1 + 0.16 * glow : 0;
    g.fillStyle(mixColors(THEME.surface, isSource ? THEME.accent : THEME.primary, tint), 1);
    g.fillRoundedRect(-half, -half, cellVisual, cellVisual, radius);
    const edge = isSource ? THEME.accent : powered ? mixColors(THEME.divider, THEME.primary, 0.55) : THEME.borderOff;
    g.lineStyle(isSource ? 3 : 2, edge, 1);
    g.strokeRoundedRect(-half, -half, cellVisual, cellVisual, radius);

    // Anillo de la pista
    if (view.hintRing) {
      g.lineStyle(5, THEME.hintRing, 1);
      g.strokeRoundedRect(-half + 3, -half + 3, cellVisual - 6, cellVisual - 6, radius * 0.9);
    }

    const w = Math.max(8, cellVisual * 0.12);
    const bridge = half + gap / 2; // llega hasta la mitad del hueco para que los cables vecinos se toquen
    const dirs: Array<{ dir: Direction; dx: number; dy: number }> = [
      { dir: Direction.NORTH, dx: 0, dy: -1 },
      { dir: Direction.EAST, dx: 1, dy: 0 },
      { dir: Direction.SOUTH, dx: 0, dy: 1 },
      { dir: Direction.WEST, dx: -1, dy: 0 },
    ];

    const legs = dirs
      .filter((d) => hasDirection(view.cell.baseMask, d.dir))
      .map((d) => {
        const worldDir = ((d.dir + view.cell.rotation) % 4) as Direction;
        const delta = DIRECTION_DELTAS[worldDir];
        const nr = view.row + delta.dr;
        const nc = view.col + delta.dc;
        const hasNeighbor = nr >= 0 && nr < this.board.rows && nc >= 0 && nc < this.board.cols;
        return {
          ...d,
          // Hacia el borde del tablero el cable termina en el borde de la casilla, sin asomar
          reach: hasNeighbor ? bridge : half,
          lit: powered && isBranchConnected(this.board, view.row, view.col, worldDir),
        };
      });
    const stroke = (leg: { dx: number; dy: number; reach: number }) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(leg.dx * leg.reach, leg.dy * leg.reach);
      g.strokePath();
    };
    const lit = legs.filter((l) => l.lit);

    // 1) Trazas apagadas: finas (el grosor distingue lo apagado aunque el color no se aprecie bien)
    for (const leg of legs.filter((l) => !l.lit)) {
      g.lineStyle(w * 0.7, THEME.wireOff, 1);
      stroke(leg);
    }
    // 2) Filamento encendido: halo degradado (tres capas), cuerpo y núcleo blanco-caliente
    for (const [scale, alpha] of [[3.1, 0.06], [2.2, 0.1], [1.55, 0.16]] as const) {
      for (const leg of lit) {
        g.lineStyle(w * scale, THEME.primary, alpha + 0.12 * glow);
        stroke(leg);
      }
    }
    for (const leg of lit) {
      g.lineStyle(w, THEME.primary, 1);
      stroke(leg);
    }
    for (const leg of lit) {
      g.lineStyle(w * (0.36 + 0.2 * glow), THEME.energyCore, 1);
      stroke(leg);
    }

    // Nodo central
    if (isSource) {
      g.fillStyle(THEME.accent, 0.2 + 0.2 * glow);
      g.fillCircle(0, 0, w * 2.7);
      g.fillStyle(THEME.accent, 1);
      g.fillCircle(0, 0, w * 1.5);
      g.fillStyle(THEME.energyCore, 1);
      g.fillCircle(0, 0, w * 0.75);
    } else if (powered) {
      g.fillStyle(THEME.primary, 0.2 + 0.3 * glow);
      g.fillCircle(0, 0, w * 1.7);
      g.fillStyle(THEME.primary, 1);
      g.fillCircle(0, 0, w * 0.95);
      g.fillStyle(THEME.energyCore, 1);
      g.fillCircle(0, 0, w * 0.42);
    } else {
      g.fillStyle(THEME.wireOffHub, 1);
      g.fillCircle(0, 0, w * 0.75);
    }
  }

  private updateFlowVisuals(): void {
    const powered = computePowerFlow(this.board);
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        this.drawCell(this.cellViews[r][c], powered[r][c]);
      }
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
   * cercana a la fuente. Usar pistas cuenta en el ajuste de dificultad y quita los bonos.
   */
  private useHint(): void {
    if (this.isWon) return;

    const target = findHintCell(this.board);
    if (!target) {
      this.showToast('Todo está bien colocado.');
      return;
    }

    const view = this.cellViews[target.row][target.col];
    if (view.isRotating) return; // espera a que termine el giro; no se cobra

    const afterPurchase = spendSparks(this.progress, HINT_COST);
    if (!afterPurchase) {
      this.showToast(`Necesitas ${HINT_COST} Chispas para una pista.\nResuelve niveles para ganar más.`);
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
    view.hintRing = true;
    rotateCell(this.board, target.row, target.col, delta);

    this.updateHud();
    this.updateHintButtonState();
    this.updateFlowVisuals();

    this.tweens.add({
      targets: view.container,
      angle: view.container.angle + delta * 90,
      duration: this.reducedMotion() ? 1 : 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
        this.evaluateVictory();
        // El anillo se mantiene un instante para que se vea qué pieza se corrigió
        this.time.delayedCall(1000, () => {
          if (this.cellViews[target.row]?.[target.col] !== view) return;
          view.hintRing = false;
          this.updateFlowVisuals();
        });
      },
    });
  }

  /** Pulso de luz que recorre el tablero desde la fuente. Devuelve su duración total en ms. */
  private playWinPulse(): number {
    if (this.reducedMotion()) return 0;

    const { rows, cols, source } = this.board;
    const powered = computePowerFlow(this.board);
    let maxDelay = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const view = this.cellViews[r][c];
        const delay = (Math.abs(r - source.row) + Math.abs(c - source.col)) * PULSE_STEP_MS;
        maxDelay = Math.max(maxDelay, delay);

        this.time.delayedCall(delay, () => {
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 240,
            yoyo: true,
            ease: 'Sine.easeOut',
            onUpdate: (tween) => {
              view.glow = tween.getValue() ?? 0;
              this.drawCell(view, powered[r][c]);
            },
            onComplete: () => {
              view.glow = 0;
              this.drawCell(view, powered[r][c]);
            },
          });
        });
      }
    }
    return maxDelay + 480;
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

    const info: VictoryInfo = {
      reward,
      isDaily: this.isDaily,
      firstDailyToday,
      isNewRecord,
      streak: currentStreak(this.progress.streak, today),
      streakIncreased: this.progress.streak.current > streakBefore,
      difficultyChange:
        this.isDaily || evaluation.newTier === playedTier ? null : evaluation.newTier > playedTier ? 'up' : 'down',
    };

    // Primero la luz recorre el circuito; después aparece el resultado
    const pulseMs = this.playWinPulse();
    this.time.delayedCall(Math.min(1100, pulseMs * 0.8), () => this.showVictoryModal(evaluation, info));
  }

  private showVictoryModal(evaluation: PerformanceEvaluation, info: VictoryInfo): void {
    const { reward } = info;

    const minTaps = this.currentLevelData.minTaps;
    const efficiency = Math.round(evaluation.tapEfficiency * 100);
    const rows: Array<{ label: string; value: string; color?: string; icon?: IconKind }> = [
      { label: 'Tiempo', value: this.formatTime(this.elapsedTime), color: info.isNewRecord ? THEME.primaryCss : undefined },
    ];
    if (info.isNewRecord) rows.push({ label: 'Récord personal', value: 'Nuevo', color: THEME.primaryCss });
    rows.push({ label: 'Toques', value: `${this.tapCount}  (mínimo ${minTaps})` });
    rows.push({ label: this.hintsUsed > 0 ? 'Eficiencia (sin pistas)' : 'Eficiencia', value: this.hintsUsed > 0 ? '—' : `${efficiency} %` });
    if (this.hintsUsed > 0) rows.push({ label: 'Pistas usadas', value: String(this.hintsUsed) });
    if (info.difficultyChange) {
      rows.push({
        label: 'Dificultad',
        value: info.difficultyChange === 'up' ? 'Sube un nivel' : 'Baja un nivel',
      });
    }
    rows.push(
      info.isDaily && !info.firstDailyToday
        ? { label: 'Chispas', value: 'Ya cobradas hoy' }
        : {
            label: reward.multiplier === 2 ? 'Chispas (doble por el reto)' : 'Chispas',
            value: `+${reward.total}`,
            color: THEME.primaryCss,
            icon: 'spark',
          }
    );
    if (info.streak > 0) {
      rows.push({
        label: 'Racha',
        value: `${info.streak} ${info.streak === 1 ? 'día' : 'días'}`,
        color: info.streakIncreased ? THEME.primaryCss : undefined,
      });
    }

    // La tarjeta se ajusta a la cantidad de filas
    const breakdownH = reward.total > 0 ? 84 : 24;
    const cardH = 200 + rows.length * 58 + breakdownH + 270;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.setAlpha(0);

    overlay.add(this.uiText(0, -cardH / 2 + 70, 'Circuito completo', { size: 34, display: true, color: THEME.primaryCss, originX: 0.5 }));
    overlay.add(
      this.uiText(0, -cardH / 2 + 124, info.isDaily ? 'Reto diario superado' : `Nivel ${this.currentLevelIndex} superado`, {
        size: 28,
        weight: '500',
        color: THEME.mutedText,
        originX: 0.5,
      })
    );

    let y = -cardH / 2 + 200;
    rows.forEach((row, i) => {
      this.addRow(overlay, w, y, row.label, row.value, { valueColor: row.color, icon: row.icon, last: i === rows.length - 1 });
      y += 58;
    });

    if (reward.total > 0) {
      overlay.add(
        this.uiText(
          0,
          y + 14,
          [
            `Base ${reward.base}`,
            reward.efficiencyBonus > 0 ? `eficiencia ${reward.efficiencyBonus}` : '',
            reward.speedBonus > 0 ? `rapidez ${reward.speedBonus}` : '',
            reward.recordBonus > 0 ? `récord ${reward.recordBonus}` : '',
          ]
            .filter(Boolean)
            .join(' + '),
          { size: FONT.small, weight: '500', color: THEME.mutedText, originX: 0.5, align: 'center', wrap: w - 80 }
        )
      );
    }

    // Botón principal: siguiente nivel, o volver al juego si venía del reto diario
    this.addCardButton(
      overlay,
      { x: 0, y: cardH / 2 - 196, w: w - 88, h: 104 },
      info.isDaily ? 'Volver al juego' : 'Siguiente nivel',
      () => {
        overlay.destroy();
        if (info.isDaily) {
          this.isDaily = false;
          this.startLevel(this.progress.currentLevel);
        } else {
          this.startLevel(this.currentLevelIndex + 1);
        }
      },
      true
    );

    this.addCardButton(
      overlay,
      { x: 0, y: cardH / 2 - 80, w: w - 88, h: 92 },
      info.isDaily ? 'Repetir el reto' : 'Repetir este nivel',
      () => {
        overlay.destroy();
        this.startLevel(this.currentLevelIndex);
      },
      false
    );

    this.tweens.add({ targets: overlay, alpha: 1, duration: this.reducedMotion() ? 1 : 320, ease: 'Power2' });
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
