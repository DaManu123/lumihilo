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
import {
  HAPTIC_LABELS,
  HAPTIC_LEVELS,
  HAPTIC_MODES,
  HAPTIC_MODE_LABELS,
  HapticLevel,
  HapticMode,
  describeDiagnostics,
  isHapticLevel,
  isHapticMode,
  vibrationBlockers,
} from '../../core/haptics';
import {
  MUSIC_STYLES,
  MUSIC_STYLE_LABELS,
  MUSIC_VOLUME_DEFAULT,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
  MusicStyle,
  isMusicStyle,
  normalizeMusicVolume,
} from '../../core/music';
import {
  ANIMATION_LABELS,
  ANIMATION_SPEEDS,
  AnimationSpeed,
  animationDuration,
  isAnimationSpeed,
  motionDisabled,
} from '../../core/accessibility';
import { LANGUAGES, LanguageSetting, isLanguageSetting, resolveLanguage, setLanguage, t } from '../../core/i18n';
import { THEME, setActiveTheme, getTheme, skinStyle } from '../theme';
import { buildBackdrop, fillNode, fillTile, strokeLitLeg, strokeTile } from '../skinArt';
import {
  LightsGrid,
  LightsLevel,
  cloneGrid,
  generateLights,
  isAllLit,
  lightsHint,
  lightsParamsForTier,
  litCount,
  toggleLights,
} from '../../core/lights';
import { PUZZLES, PUZZLE_LABELS, PuzzleType, isPuzzleType, lightsRecordKey } from '../../core/puzzles';
import { SKINS, SkinId, buySkin, isSkinUnlocked, skinInfo, usableSkin } from '../../core/skins';
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
import { storage, feedback, UserSettings, RotationDirection, createUpdateService } from '../../services';
import { APP_VERSION } from '../../config';
import { UpdateInfo, shouldPromptUpdate } from '../../core/updates';
import { APP_NAME } from '../../config';

interface CellView {
  container: Phaser.GameObjects.Container;
  /** Imagen de la casilla: se cambia de textura según su estado (ver `drawCell`). */
  img: Phaser.GameObjects.Image;
  /** Clave de la textura que muestra ahora; evita repintar si nada cambió. */
  textureKey: string;
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

/** Niveles de brillo distintos durante el pulso de victoria (el ojo no distingue más). */
const GLOW_STEPS = 8;

/**
 * Texturas ya pintadas de las casillas. Phaser vuelve a calcular todo lo que contiene un objeto
 * `Graphics` en CADA fotograma, aunque no cambie; con un tablero grande eso ahogaba a los teléfonos de
 * gama baja. Cada aspecto distinto de casilla se pinta una vez en una textura y después solo se dibuja
 * esa imagen, que cuesta casi nada. Es el mismo dibujo, sin cambios visibles.
 */
const cellTextureKeys = new Set<string>();
let cellTexturePrefix = '';

interface CellLeg {
  dx: number;
  dy: number;
  /** Hasta dónde llega el cable desde el centro. */
  reach: number;
  lit: boolean;
}

/** Todo lo que cambia el aspecto de una casilla (y por tanto define su textura). */
interface CellLook {
  powered: boolean;
  isSource: boolean;
  hintRing: boolean;
  /** Paso de brillo, de 0 a GLOW_STEPS. */
  glowStep: number;
  /** Marcas en las esquinas de las casillas encendidas. */
  marks: boolean;
  legs: CellLeg[];
  /** Casilla del puzzle Luces (`powered` es «encendida», sin cables). */
  lights?: boolean;
}

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
  /** Puzzle en juego (Circuitos o Luces) y, en Luces, el estado de las luces y su última casilla tocada. */
  private puzzle: PuzzleType = 'circuits';
  private lightGrid: LightsGrid = [];
  private lastLightsTap: { row: number; col: number } | null = null;
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
  private dirSub!: Phaser.GameObjects.Text;
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
    if (!isLanguageSetting(this.settings.language)) this.settings.language = 'auto';
    this.applyLanguage();
    this.settings.skin = usableSkin(this.progress, this.settings.skin);
    setActiveTheme(this.settings.theme, this.settings.highContrast === true, this.settings.skin);
    this.rotationDirection = this.settings.rotationDirection === 'ccw' ? 'ccw' : 'cw';
    this.puzzle = isPuzzleType(this.settings.puzzle) ? this.settings.puzzle : 'circuits';
    this.currentLevelIndex = this.puzzleLevel();
    // Los ajustes guardados pueden venir de una versión antigua o corruptos: se validan al cargarlos
    if (!isHapticLevel(this.settings.hapticsLevel)) this.settings.hapticsLevel = 'normal';
    if (!isHapticMode(this.settings.hapticsMode)) this.settings.hapticsMode = 'all';
    if (!isMusicStyle(this.settings.musicStyle)) this.settings.musicStyle = 'swing';
    if (!isAnimationSpeed(this.settings.animationSpeed)) this.settings.animationSpeed = 'normal';
    this.settings.highContrast = this.settings.highContrast === true;
    this.settings.litMarks = this.settings.litMarks === true;
    this.settings.musicVolume = normalizeMusicVolume(this.settings.musicVolume);
    feedback.configure({
      sound: this.settings.soundEnabled,
      music: this.settings.musicEnabled,
      musicStyle: this.settings.musicStyle,
      musicVolume: this.settings.musicVolume,
      haptics: this.settings.hapticsEnabled,
      hapticsLevel: this.settings.hapticsLevel,
      hapticsMode: this.settings.hapticsMode,
    });
    // Los navegadores solo permiten audio tras un gesto: se habilita con el primer toque
    this.input.once('pointerdown', () => feedback.unlock());

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
    this.scheduleUpdateCheck();

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
    this.applyBackdrop();
  }

  private backdropObjects: Phaser.GameObjects.GameObject[] = [];
  private backdropTweens: Phaser.Tweens.Tween[] = [];

  /** Fondo propio del aspecto (cuadrícula, lluvia de código u órbitas). El alto contraste lo atenúa y lo deja quieto. */
  private applyBackdrop(): void {
    for (const tween of this.backdropTweens) tween.stop();
    this.backdropTweens = [];
    for (const object of this.backdropObjects) object.destroy();
    this.backdropObjects = [];
    const hc = this.settings.highContrast === true;
    const { width, height } = this.cameras.main;
    const result = buildBackdrop(this, skinStyle(THEME.skin), THEME, width, height, {
      alpha: hc ? 0.3 : THEME.name === 'light' ? 0.55 : 1,
      animate: !hc && !this.reducedMotion(),
    });
    if (!result) return;
    this.backdropObjects = result.objects;
    this.backdropTweens = result.tweens;
  }

  /** Cantidad de casillas con energía (para detectar cuándo un giro conecta algo nuevo). */
  private poweredCount(): number {
    return computePowerFlow(this.board).reduce((total, row) => total + row.filter(Boolean).length, 0);
  }

  /** Aplica el idioma elegido (o el del dispositivo si está en automático). */
  private applyLanguage(): void {
    const device = typeof navigator !== 'undefined' ? navigator.language : undefined;
    setLanguage(resolveLanguage(this.settings.language, device));
  }

  /** Preferencia del sistema de reducir el movimiento. */
  private systemReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  /** Sin animaciones decorativas: por el ajuste del juego o por la preferencia del sistema. */
  private reducedMotion(): boolean {
    return motionDisabled(this.settings.animationSpeed, this.systemReducedMotion());
  }

  /** Duración de una animación según la velocidad elegida (1 ms si no hay animaciones). */
  private dur(ms: number): number {
    return animationDuration(ms, this.settings.animationSpeed, this.systemReducedMotion());
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
    return mode === 'relaxed' ? t('Relajado') : mode === 'challenge' ? t('Reto') : t('Normal');
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

    this.levelText.setText(this.isDaily ? t('Reto diario') : t('Nivel {0}', this.currentLevelIndex));
    this.timerText.setText(this.formatTime(this.elapsedTime));
    this.tapsText.setText(t(this.tapCount === 1 ? '{0} toque' : '{0} toques', this.tapCount));

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

    this.setSegment(this.modeSeg, { label: this.modeLabel(this.profile.mode), sub: t('Modo') });
    this.setSegment(
      this.dailySeg,
      this.isDaily
        ? { label: t('Volver'), kind: 'home', sub: t('al juego') }
        : { label: t('Diario'), kind: 'calendar', sub: dailyDone ? t('hecho hoy') : t('reto de hoy') }
    );
    this.setSegment(this.themeSeg, {
      label: this.settings.theme === 'light' ? t('Claro') : t('Oscuro'),
      kind: this.settings.theme === 'light' ? 'sun' : 'moon',
      sub: t('Tema'),
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
    this.setSegment(reset, { label: t('Reiniciar'), kind: 'reset' });

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
    this.dirSub = this.uiText(40, 26, t('Toca para cambiar el sentido'), {
      size: FONT.small,
      weight: '500',
      color: THEME.mutedText,
      originX: 0.5,
    });
    const sub = this.dirSub;
    const zone = this.add.zone(0, 0, rect.w, rect.h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.toggleRotationDirection());

    this.dirBtn.add([this.dirPanel, this.dirIcon, this.dirTitle, sub, zone]);
    this.renderDirectionButton();
  }

  private renderDirectionButton(): void {
    if (this.puzzle === 'lights') {
      // En Luces no se gira nada: el panel recuerda cómo se juega
      const { w, h } = this.dirRect;
      this.dirPanel.clear();
      this.dirPanel.fillStyle(mixColors(THEME.surface, THEME.primary, 0.1), 1);
      this.dirPanel.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
      this.dirPanel.lineStyle(4, THEME.primary, 1);
      this.dirPanel.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
      this.dirTitle.setText(t('Enciende todo')).setColor(THEME.primaryCss);
      this.dirSub.setText(t('Cada toque cambia la casilla y sus vecinas'));
      this.dirIcon.clear();
      drawIcon(this.dirIcon, 'bulb', -w / 2 + 84, 0, 56, THEME.primary, THEME.surface);
      return;
    }
    this.dirSub.setText(t('Toca para cambiar el sentido'));
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

    this.dirTitle.setText(clockwise ? t('Giro horario') : t('Giro antihorario')).setColor(colorCss);

    this.dirIcon.clear();
    drawArrowCircle(this.dirIcon, -w / 2 + 84, 0, 28, color, 9, clockwise ? 1 : -1);
  }

  private toggleRotationDirection(): void {
    if (this.puzzle === 'lights') return;
    this.rotationDirection = this.rotationDirection === 'cw' ? 'ccw' : 'cw';
    this.settings.rotationDirection = this.rotationDirection;
    storage.saveSettings(this.settings);
    this.renderDirectionButton();
    feedback.toggle();

    if (!this.reducedMotion()) {
      // Pequeño "pulso" de confirmación (sin parpadeos)
      this.tweens.add({ targets: this.dirBtn, scale: 1.04, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    }
  }

  private updateUndoButtonState(): void {
    if (!this.undoSeg) return;
    const canUndo = this.moveHistory.length > 0 && !this.isWon;
    this.setSegment(this.undoSeg, {
      label: t('Deshacer'),
      kind: 'undo',
      iconColor: canUndo ? THEME.primary : THEME.wireOff,
      labelColor: canUndo ? THEME.text : THEME.mutedText,
    });
  }

  private updateHintButtonState(): void {
    if (!this.hintSeg) return;
    const canHint = this.progress.sparks >= HINT_COST && !this.isWon;
    this.setSegment(this.hintSeg, {
      label: t('Pista'),
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
  private createCard(
    cardH: number,
    depth: number
  ): { overlay: Phaser.GameObjects.Container; w: number; backdrop: Phaser.GameObjects.Rectangle } {
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
    return { overlay, w, backdrop };
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

  /** Fila de ajuste con interruptor (fila táctil de 84 px de alto). */
  private addToggleRow(
    overlay: Phaser.GameObjects.Container,
    cardW: number,
    y: number,
    label: string,
    initial: boolean,
    onChange: (value: boolean) => void
  ): void {
    const left = -cardW / 2 + 44;
    const right = cardW / 2 - 44;
    const switchW = 96;
    const switchH = 52;
    let value = initial;

    const track = this.add.graphics();
    const draw = () => {
      track.clear();
      const x = right - switchW;
      if (value) {
        track.fillStyle(THEME.primary, 1);
        track.fillRoundedRect(x, y - switchH / 2, switchW, switchH, switchH / 2);
        track.fillStyle(THEME.surface, 1);
        track.fillCircle(x + switchW - switchH / 2, y, switchH / 2 - 7);
      } else {
        track.lineStyle(3, THEME.wireOff, 1);
        track.strokeRoundedRect(x, y - switchH / 2, switchW, switchH, switchH / 2);
        track.fillStyle(THEME.wireOff, 1);
        track.fillCircle(x + switchH / 2, y, switchH / 2 - 9);
      }
    };
    draw();

    const text = this.uiText(left, y, label, { size: 29, weight: '600' });
    const stateText = this.uiText(right - switchW - 18, y, '', { size: FONT.small, weight: '500', color: THEME.mutedText, originX: 1 });
    const refreshText = () => stateText.setText(value ? t('Activado') : t('Desactivado'));
    refreshText();

    const zone = this.hitZone({ x: 0, y, w: cardW - 40, h: 84 }, () => {
      value = !value;
      draw();
      refreshText();
      onChange(value);
    });
    overlay.add([text, stateText, track, zone]);
  }

  /**
   * Selector de una opción entre varias (control segmentado). Cada segmento mide ≥ 48 dp de alto.
   * Devuelve una función para activarlo o desactivarlo (atenuado e ignorando toques).
   */
  private addChoiceRow(
    overlay: Phaser.GameObjects.Container,
    cardW: number,
    y: number,
    label: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    initial: string,
    onChange: (value: string) => void
  ): (enabled: boolean) => void {
    const left = -cardW / 2 + 44;
    const width = cardW - 88;
    const height = 88;
    const top = y + 40;
    const segW = width / options.length;
    let value = initial;
    let enabled = true;

    const group = this.add.container(0, 0);
    const panel = this.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];
    const draw = () => {
      panel.clear();
      panel.lineStyle(2, THEME.divider, 1);
      panel.strokeRoundedRect(left, top, width, height, 26);
      options.forEach((option, i) => {
        const selected = option.value === value;
        if (selected) {
          panel.fillStyle(THEME.primary, 1);
          panel.fillRoundedRect(left + i * segW + 6, top + 6, segW - 12, height - 12, 21);
        }
        labels[i].setColor(selected ? THEME.onPrimary : THEME.text);
      });
    };

    group.add(this.uiText(left, y, label, { size: 29, weight: '600' }));
    group.add(panel);
    options.forEach((option, i) => {
      const text = this.uiText(left + i * segW + segW / 2, top + height / 2, option.label, {
        size: FONT.button,
        weight: '700',
        originX: 0.5,
      });
      labels.push(text);
      group.add(text);
      group.add(
        this.hitZone({ x: left + i * segW + segW / 2, y: top + height / 2, w: segW, h: height }, () => {
          if (!enabled || value === option.value) return;
          value = option.value;
          draw();
          onChange(value);
        })
      );
    });
    draw();
    overlay.add(group);
    return (on: boolean) => {
      enabled = on;
      group.setAlpha(on ? 1 : 0.4);
    };
  }

  /**
   * Barra deslizante (se arrastra o se toca en cualquier punto). `marker` señala el valor estándar con una
   * marca. Devuelve una función para activarla o desactivarla (atenuada e ignorando toques).
   * `onChange` se llama mientras se arrastra (para oír el cambio al momento) y `onCommit` al soltar.
   */
  private addSliderRow(
    overlay: Phaser.GameObjects.Container,
    cardW: number,
    y: number,
    label: string,
    opts: {
      min: number;
      max: number;
      step: number;
      value: number;
      marker: number;
      markerLabel: string;
      format: (value: number) => string;
      onChange: (value: number) => void;
      onCommit: (value: number) => void;
    }
  ): (enabled: boolean) => void {
    const left = -cardW / 2 + 56;
    const right = cardW / 2 - 56;
    const trackY = y + 70;
    const span = opts.max - opts.min;
    const toX = (v: number) => left + ((v - opts.min) / span) * (right - left);
    let value = opts.value;
    let enabled = true;
    let dragging = false;

    const group = this.add.container(0, 0);
    const valueText = this.uiText(cardW / 2 - 44, y, '', { size: 28, display: true, weight: '600', color: THEME.primaryCss, originX: 1 });
    const graphics = this.add.graphics();
    const draw = () => {
      graphics.clear();
      const x = toX(value);
      graphics.fillStyle(THEME.divider, 1);
      graphics.fillRoundedRect(left, trackY - 8, right - left, 16, 8);
      graphics.fillStyle(THEME.primary, 1);
      graphics.fillRoundedRect(left, trackY - 8, Math.max(8, x - left), 16, 8);
      // Marca del valor estándar
      const mx = toX(opts.marker);
      graphics.fillStyle(THEME.wireOffHub, 1);
      graphics.fillRoundedRect(mx - 2, trackY - 22, 4, 44, 2);
      // Tirador
      graphics.fillStyle(THEME.primary, 1);
      graphics.fillCircle(x, trackY, 28);
      graphics.fillStyle(THEME.surface, 1);
      graphics.fillCircle(x, trackY, 12);
      valueText.setText(opts.format(value));
    };

    const valueFromPointer = (pointer: Phaser.Input.Pointer): number => {
      const local = pointer.x - overlay.x;
      const t = Math.min(1, Math.max(0, (local - left) / (right - left)));
      let v = opts.min + Math.round((t * span) / opts.step) * opts.step;
      // Cerca del valor estándar "se pega" a él, para poder volver a él con facilidad
      if (Math.abs(v - opts.marker) <= opts.step * 1.5) v = opts.marker;
      return Math.min(opts.max, Math.max(opts.min, v));
    };
    const update = (pointer: Phaser.Input.Pointer) => {
      const next = valueFromPointer(pointer);
      if (next === value) return;
      value = next;
      draw();
      opts.onChange(value);
    };
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', finish);
      opts.onCommit(value);
    };
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (dragging && pointer.isDown) update(pointer);
    };

    const zone = this.add.zone(0, trackY, cardW - 20, 96).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!enabled) return;
      dragging = true;
      update(pointer);
      this.input.on('pointermove', onMove);
      this.input.on('pointerup', finish);
    });
    // Si la tarjeta se cierra a mitad de un arrastre no quedan escuchas colgadas
    overlay.once('destroy', () => {
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', finish);
    });

    group.add([this.uiText(-cardW / 2 + 44, y, label, { size: 29, weight: '600' }), valueText, graphics, zone]);
    group.add(
      this.uiText(toX(opts.marker), trackY + 44, opts.markerLabel, {
        size: FONT.small,
        weight: '500',
        color: THEME.mutedText,
        originX: 0.5,
      })
    );
    draw();
    overlay.add(group);
    return (on: boolean) => {
      enabled = on;
      group.setAlpha(on ? 1 : 0.4);
    };
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

  /**
   * Busca una versión nueva poco después de abrir el juego y, si la hay, se lo pregunta al jugador una sola vez por
   * versión. Si dice que no, se sigue jugando sin más. No molesta durante el tutorial ni con una tarjeta abierta.
   */
  private scheduleUpdateCheck(): void {
    if (!this.settings.hasSeenTutorial) return;
    const service = createUpdateService();
    this.time.delayedCall(3000, async () => {
      const latest = await service.check();
      if (!this.scene.isActive() || !shouldPromptUpdate(APP_VERSION, latest, this.settings.updatePromptedVersion)) return;
      if (this.isWon || this.children.getAll().some((o) => ((o as { depth?: number }).depth ?? 0) >= 100)) return; // se vuelve a intentar al abrir otra vez
      this.settings.updatePromptedVersion = latest!.version;
      storage.saveSettings(this.settings);
      this.showUpdateModal(latest!, () => void service.open(latest!));
    });
  }

  private showUpdateModal(info: UpdateInfo, onUpdate: () => void): void {
    const cardH = 620;
    const { overlay, w } = this.createCard(cardH, 300);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Hay una versión nueva'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));
    const body = this.uiText(0, -cardH / 2 + 150, t('Ya está disponible Lumihilo {0}. Tú tienes la {1}.', info.version, APP_VERSION), {
      size: 28,
      weight: '600',
      color: THEME.text,
      wrap: w - 88,
      originX: 0.5,
    });
    body.setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    const note = this.uiText(0, -cardH / 2 + 300, t('Puedes seguir jugando: actualizar es opcional y no volveremos a preguntarte por esta versión.'), {
      size: 24,
      weight: '500',
      color: THEME.mutedText,
      wrap: w - 88,
      originX: 0.5,
    });
    note.setOrigin(0.5, 0).setAlign('center').setLineSpacing(6);
    overlay.add([body, note]);

    const btnW = (w - 88 - 18) / 2;
    const btnY = cardH / 2 - 84;
    this.addCardButton(overlay, { x: -(btnW + 18) / 2, y: btnY, w: btnW, h: 100 }, t('Ahora no'), () => overlay.destroy(), false);
    this.addCardButton(
      overlay,
      { x: (btnW + 18) / 2, y: btnY, w: btnW, h: 100 },
      t('Actualizar'),
      () => {
        overlay.destroy();
        onUpdate();
      },
      true
    );
  }

  private checkAndShowTutorial(): void {
    if (this.settings.hasSeenTutorial) return;

    const cardH = 700;
    const { overlay, w } = this.createCard(cardH, 100);

    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Cómo se juega'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    const lines = [
      t('Toca una pieza para girarla.'),
      t('El botón grande cambia el sentido del giro.'),
      t('Conecta todo el circuito a la fuente.'),
      t('Gana Chispas y úsalas en las pistas.'),
      t('Cada día hay un reto nuevo. Cuida tu racha.'),
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
      t('Entendido'),
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

    const days = (n: number) => t(n === 1 ? '{0} día' : '{0} días', n);
    const rows: Array<[string, string, IconKind?]> = [
      [t('Chispas'), String(this.progress.sparks), 'spark'],
      [t('Racha actual'), days(shownStreak)],
      [t('Mejor racha'), days(streak.best)],
      [t('Niveles resueltos'), String(stats.levelsSolved)],
      [t('Sin pistas y sin fallos'), String(stats.perfectSolves)],
      [t('Retos diarios'), String(stats.dailyCompleted)],
      [t('Mejor tiempo (habilidad {0})', tier), best !== undefined ? this.formatTime(best) : '—'],
      [t('Nivel de habilidad'), String(tier)],
      [t('Puntuación'), String(this.profile.rating)],
    ];

    const rowH = 58;
    const cardH = 150 + rows.length * rowH + 190 + 150;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Estadísticas'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    let y = -cardH / 2 + 160;
    rows.forEach(([label, value, icon], i) => {
      this.addRow(overlay, w, y, label, value, { icon, last: i === rows.length - 1 });
      y += rowH;
    });

    // Puzzle al que se juega
    this.addChoiceRow(
      overlay,
      w,
      y + 30,
      t('Puzzle'),
      PUZZLES.map((puzzle) => ({ value: puzzle, label: t(PUZZLE_LABELS[puzzle]) })),
      this.puzzle,
      (value) => {
        overlay.destroy();
        this.setPuzzle(value as PuzzleType);
      }
    );

    // Tres botones: Ajustes y Aspectos (secundarios) y Cerrar (principal)
    const gap = 14;
    const btnW = (w - 88 - 2 * gap) / 3;
    const btnY = cardH / 2 - 84;
    const slot = (i: number) => (i - 1) * (btnW + gap);
    this.addCardButton(
      overlay,
      { x: slot(0), y: btnY, w: btnW, h: 100 },
      t('Ajustes'),
      () => {
        overlay.destroy();
        this.showSettingsModal();
      },
      false
    );
    this.addCardButton(
      overlay,
      { x: slot(1), y: btnY, w: btnW, h: 100 },
      t('Aspectos'),
      () => {
        overlay.destroy();
        this.showSkinsModal();
      },
      false
    );
    this.addCardButton(overlay, { x: slot(2), y: btnY, w: btnW, h: 100 }, t('Cerrar'), () => overlay.destroy(), true);
  }

  /**
   * Tienda de aspectos: paletas que se compran con Chispas. Tocar uno comprado lo equipa; uno bloqueado se compra
   * (y se equipa) si alcanzan las Chispas. Es solo estética.
   */
  private showSkinsModal(message = ''): void {
    const rowH = 150;
    const cardH = 160 + SKINS.length * rowH + 150 + 130;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Aspectos'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    const left = -w / 2 + 44;
    const right = w / 2 - 44;
    let y = -cardH / 2 + 160 + rowH / 2;
    for (const skin of SKINS) {
      const preview = getTheme(this.settings.theme, false, skin.id);
      const unlocked = isSkinUnlocked(this.progress, skin.id);
      const equipped = this.settings.skin === skin.id;

      const g = this.add.graphics();
      // Muestra del aspecto: su fondo con tres colores característicos
      g.fillStyle(preview.background, 1);
      g.fillRoundedRect(left, y - 52, 190, 104, 22);
      g.lineStyle(2, equipped ? THEME.primary : THEME.cardBorder, 1);
      g.strokeRoundedRect(left, y - 52, 190, 104, 22);
      // Dos casillas en miniatura con su forma, un cable encendido y sus nodos
      const look = skinStyle(skin.id);
      const tile = 62;
      const wireW = 9 * look.wireScale;
      g.save();
      g.translateCanvas(left + 50, y);
      g.fillStyle(mixColors(preview.surface, preview.accent, 0.2), 1);
      fillTile(g, look, tile, 12);
      g.lineStyle(2, preview.accent, 1);
      strokeTile(g, look, tile, 12);
      g.restore();
      g.save();
      g.translateCanvas(left + 140, y);
      g.fillStyle(mixColors(preview.surface, preview.primary, 0.2), 1);
      fillTile(g, look, tile, 12);
      g.lineStyle(2, mixColors(preview.divider, preview.primary, 0.55), 1);
      strokeTile(g, look, tile, 12);
      g.restore();
      g.save();
      g.translateCanvas(left + 50, y);
      strokeLitLeg(g, look, preview, { dx: 1, dy: 0, reach: 90 }, wireW, 0.6);
      fillNode(g, look, wireW * 1.3, preview.accent);
      fillNode(g, look, wireW * 0.6, preview.energyCore);
      g.translateCanvas(90, 0);
      fillNode(g, look, wireW * 0.9, preview.primary);
      fillNode(g, look, wireW * 0.4, preview.energyCore);
      g.restore();
      if (equipped) {
        g.lineStyle(4, THEME.primary, 1);
        g.strokeRoundedRect(-w / 2 + 14, y - rowH / 2 + 8, w - 28, rowH - 16, 26);
      }
      overlay.add(g);

      overlay.add(this.uiText(left + 222, y - 18, t(skin.name), { size: 32, display: true, weight: '700', color: THEME.text }));
      const state = equipped ? t('Equipado') : unlocked ? t('Usar') : '';
      if (state) {
        overlay.add(
          this.uiText(right, y + 22, state, {
            size: 26,
            weight: '700',
            color: equipped ? THEME.primaryCss : THEME.text,
            originX: 1,
          })
        );
      } else {
        const affordable = this.progress.sparks >= skin.price;
        const price = this.uiText(right, y + 22, String(skin.price), {
          size: 28,
          display: true,
          weight: '700',
          color: affordable ? THEME.primaryCss : THEME.mutedText,
          originX: 1,
        });
        const icon = this.add.graphics();
        drawIcon(icon, 'spark', right - price.width - 26, y + 22, 30, affordable ? THEME.primary : THEME.wireOff, THEME.surface);
        overlay.add([price, icon]);
      }
      overlay.add(
        this.hitZone({ x: 0, y, w: w - 28, h: rowH - 16 }, () => this.onSkinTapped(skin.id, overlay))
      );
      y += rowH;
    }

    const balance = this.uiText(0, cardH / 2 - 200, message || t('Tus Chispas: {0}', this.progress.sparks), {
      size: 26,
      weight: '600',
      color: message ? THEME.accentCss : THEME.mutedText,
      originX: 0.5,
    });
    overlay.add(balance);

    this.addCardButton(overlay, { x: 0, y: cardH / 2 - 84, w: w - 88, h: 100 }, t('Listo'), () => overlay.destroy(), true);
  }

  private onSkinTapped(id: SkinId, overlay: Phaser.GameObjects.Container): void {
    if (this.settings.skin === id) return;
    if (!isSkinUnlocked(this.progress, id)) {
      const bought = buySkin(this.progress, id);
      if (!bought) {
        feedback.toggle();
        overlay.destroy();
        this.showSkinsModal(t('Te faltan {0} Chispas para {1}', skinInfo(id).price - this.progress.sparks, t(skinInfo(id).name)));
        return;
      }
      this.progress = bought;
      storage.saveProgress(this.progress);
    }
    this.settings.skin = id;
    storage.saveSettings(this.settings);
    feedback.toggle();
    setActiveTheme(this.settings.theme, this.settings.highContrast, id);
    this.applyBackground();
    // La interfaz y el tablero se redibujan con la nueva paleta; se reabre esta tarjeta para que también la use
    overlay.destroy();
    this.buildUi();
    this.buildBoard();
    this.updateFlowVisuals();
    this.showSkinsModal();
  }

  /** Ajustes: efectos, música (estilo y volumen), vibración (intensidad y prueba). Se guardan al instante. */
  private showSettingsModal(): void {
    const cardH = 1150;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Ajustes'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    let y = -cardH / 2 + 170;
    this.addToggleRow(overlay, w, y, t('Efectos'), this.settings.soundEnabled, (value) => {
      this.settings.soundEnabled = value;
      storage.saveSettings(this.settings);
      feedback.configure({ sound: value });
      feedback.toggle(); // al activarlos suena una muestra
    });
    y += 84;

    // Estilo y volumen de la música solo tienen sentido con la música encendida
    let setStyleEnabled: (enabled: boolean) => void = () => undefined;
    let setVolumeEnabled: (enabled: boolean) => void = () => undefined;
    this.addToggleRow(overlay, w, y, t('Música'), this.settings.musicEnabled, (value) => {
      this.settings.musicEnabled = value;
      storage.saveSettings(this.settings);
      feedback.configure({ music: value });
      setStyleEnabled(value);
      setVolumeEnabled(value);
    });
    y += 90;

    setStyleEnabled = this.addChoiceRow(
      overlay,
      w,
      y,
      t('Estilo de la música'),
      MUSIC_STYLES.map((style) => ({ value: style, label: t(MUSIC_STYLE_LABELS[style]) })),
      this.settings.musicStyle,
      (value) => {
        this.settings.musicStyle = value as MusicStyle;
        storage.saveSettings(this.settings);
        feedback.configure({ musicStyle: this.settings.musicStyle });
      }
    );
    y += 170;

    setVolumeEnabled = this.addSliderRow(overlay, w, y, t('Volumen de la música'), {
      min: MUSIC_VOLUME_MIN,
      max: MUSIC_VOLUME_MAX,
      step: 5,
      value: this.settings.musicVolume,
      marker: MUSIC_VOLUME_DEFAULT,
      markerLabel: t('estándar'),
      format: (value) => `${value} %`,
      onChange: (value) => feedback.configure({ musicVolume: value }), // se oye mientras se arrastra
      onCommit: (value) => {
        this.settings.musicVolume = value;
        storage.saveSettings(this.settings);
      },
    });
    y += 170;
    setStyleEnabled(this.settings.musicEnabled);
    setVolumeEnabled(this.settings.musicEnabled);

    let setIntensityEnabled: (enabled: boolean) => void = () => undefined;
    this.addToggleRow(overlay, w, y, t('Vibración'), this.settings.hapticsEnabled, (value) => {
      this.settings.hapticsEnabled = value;
      storage.saveSettings(this.settings);
      feedback.configure({ haptics: value });
      setIntensityEnabled(value);
      feedback.previewHaptics(); // al activarla vibra una vez
    });
    y += 90;

    setIntensityEnabled = this.addChoiceRow(
      overlay,
      w,
      y,
      t('Intensidad de la vibración'),
      HAPTIC_LEVELS.map((level) => ({ value: level, label: t(HAPTIC_LABELS[level]) })),
      this.settings.hapticsLevel,
      (value) => {
        const level = value as HapticLevel;
        this.settings.hapticsLevel = level;
        storage.saveSettings(this.settings);
        feedback.configure({ hapticsLevel: level });
        feedback.previewHaptics(); // se nota al momento qué intensidad se eligió
      }
    );
    setIntensityEnabled(this.settings.hapticsEnabled);
    y += 170;

    const half = (w - 88 - 18) / 2;
    y += 8; // un respiro respecto a la fila de intensidad
    this.addCardButton(
      overlay,
      { x: -(half + 18) / 2, y, w: half, h: 88 },
      t('Accesibilidad'),
      () => {
        overlay.destroy();
        this.showAccessibilityModal();
      },
      false
    );
    this.addCardButton(overlay, { x: (half + 18) / 2, y, w: half, h: 88 }, t('¿No vibra?'), () => this.showHapticsModal(), false);

    this.addCardButton(overlay, { x: 0, y: cardH / 2 - 84, w: w - 88, h: 100 }, t('Listo'), () => overlay.destroy(), true);
  }

  private languageLabel(language: LanguageSetting): string {
    return language === 'auto' ? t('Automático') : language === 'es' ? t('Español') : t('English');
  }

  /** Accesibilidad: alto contraste, marcas en las piezas encendidas y velocidad de animación. */
  private showAccessibilityModal(): void {
    const cardH = 990;
    const { overlay, w } = this.createCard(cardH, 200);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Accesibilidad'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    let y = -cardH / 2 + 170;
    this.addToggleRow(overlay, w, y, t('Alto contraste'), this.settings.highContrast, (value) => {
      this.settings.highContrast = value;
      storage.saveSettings(this.settings);
      feedback.toggle();
      setActiveTheme(this.settings.theme, value, this.settings.skin);
      this.applyBackground();
      // La interfaz y el tablero se redibujan con la nueva paleta; se reabre esta tarjeta para que también la use
      overlay.destroy();
      this.buildUi();
      this.buildBoard();
      this.updateFlowVisuals();
      this.showAccessibilityModal();
    });
    y += 90;

    this.addToggleRow(overlay, w, y, t('Marcas de energía'), this.settings.litMarks, (value) => {
      this.settings.litMarks = value;
      storage.saveSettings(this.settings);
      feedback.toggle();
      this.updateFlowVisuals();
    });
    y += 90;

    const hint = this.uiText(-w / 2 + 44, y - 4, t('Cuatro puntos en las esquinas de cada pieza con energía, para distinguirlas sin depender del color.'), {
      size: 22,
      weight: '500',
      color: THEME.mutedText,
      wrap: w - 88,
    });
    hint.setOrigin(0, 0).setLineSpacing(4);
    overlay.add(hint);
    y += 130;

    this.addChoiceRow(
      overlay,
      w,
      y,
      t('Velocidad de las animaciones'),
      ANIMATION_SPEEDS.map((speed) => ({ value: speed, label: t(ANIMATION_LABELS[speed]) })),
      this.settings.animationSpeed,
      (value) => {
        this.settings.animationSpeed = value as AnimationSpeed;
        storage.saveSettings(this.settings);
        feedback.toggle();
      }
    );
    y += 170;

    this.addChoiceRow(
      overlay,
      w,
      y,
      t('Idioma'),
      LANGUAGES.map((language) => ({ value: language, label: this.languageLabel(language) })),
      this.settings.language,
      (value) => {
        this.settings.language = value as LanguageSetting;
        storage.saveSettings(this.settings);
        this.applyLanguage();
        feedback.toggle();
        // Toda la interfaz se redibuja en el idioma nuevo y se reabre esta tarjeta
        overlay.destroy();
        this.buildUi();
        this.buildBoard();
        this.updateFlowVisuals();
        this.showAccessibilityModal();
      }
    );

    this.addCardButton(overlay, { x: 0, y: cardH / 2 - 84, w: w - 88, h: 100 }, t('Listo'), () => overlay.destroy(), true);
  }

  /**
   * Prueba y diagnóstico de la vibración. En el teléfono lee los ajustes que pueden bloquearla (intensidades,
   * silencio, "No molestar", ahorro de batería) y deja elegir por qué vía se envía, probando cada una al momento.
   */
  private showHapticsModal(): void {
    const cardH = 1150;
    const { overlay, w } = this.createCard(cardH, 210);
    overlay.add(this.uiText(0, -cardH / 2 + 70, t('Vibración'), { size: 36, display: true, color: THEME.primaryCss, originX: 0.5 }));

    const left = -w / 2 + 44;
    const info = this.uiText(left, -cardH / 2 + 130, t('Leyendo los ajustes del teléfono…'), {
      size: FONT.small,
      weight: '500',
      color: THEME.mutedText,
      wrap: w - 88,
    });
    info.setOrigin(0, 0).setLineSpacing(4);
    overlay.add(info);

    void feedback.lastCrash().then((crash) => {
      if (!crash || !info.active) return;
      // El cierre anterior de la app: lo enseñamos para poder corregirlo
      info.setText(t('La app se cerró antes por:\n{0}', crash.split('\n').slice(0, 7).join('\n').slice(0, 520)));
      info.setFontSize(20);
    });

    void feedback.diagnoseHaptics().then((diagnostics) => {
      if (!info.active) return; // la tarjeta ya se cerró
      if (!diagnostics) {
        info.setText(
          t('Estos datos solo se pueden leer en la app de Android (APK). En el navegador no hay motor de vibración que diagnosticar.')
        );
        return;
      }
      // Lo más importante primero: qué puede estar bloqueando la vibración; después, los datos del teléfono
      const blockers = vibrationBlockers(diagnostics);
      info.setText(
        (blockers.length
          ? t('Posibles causas:\n{0}', blockers.map((b) => `• ${b}`).join('\n'))
          : t('No se detectó ningún ajuste del teléfono que bloquee la vibración.')) +
          '\n\n' +
          describeDiagnostics(diagnostics).join('\n')
      );
    });

    const result = this.uiText(left, 0, '', { size: FONT.small, weight: '600', color: THEME.text, wrap: w - 88 });
    result.setOrigin(0, 0).setLineSpacing(6);
    const runTest = () => {
      result.setText(t('Probando…'));
      void feedback.testHaptics().then((text) => {
        if (result.active) result.setText(text);
      });
    };

    const methodY = -cardH / 2 + 130 + 560;
    this.addChoiceRow(
      overlay,
      w,
      methodY,
      t('Método (Auto suele bastar)'),
      HAPTIC_MODES.map((mode) => ({ value: mode, label: t(HAPTIC_MODE_LABELS[mode]) })),
      this.settings.hapticsMode,
      (value) => {
        this.settings.hapticsMode = value as HapticMode;
        storage.saveSettings(this.settings);
        feedback.configure({ hapticsMode: this.settings.hapticsMode });
        runTest(); // se prueba al elegir, para notar la diferencia al momento
      }
    );

    result.setPosition(left, methodY + 150);
    overlay.add(result);

    const buttonsY = cardH / 2 - 84;
    const btnW = (w - 88 - 18) / 2;
    this.addCardButton(overlay, { x: -(btnW + 18) / 2, y: buttonsY, w: btnW, h: 100 }, t('Probar'), runTest, false);
    this.addCardButton(overlay, { x: (btnW + 18) / 2, y: buttonsY, w: btnW, h: 100 }, t('Listo'), () => overlay.destroy(), true);
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

    if (this.puzzle === 'lights' && !this.isDaily) {
      this.loadLightsLevel(levelIndex);
      return;
    }

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

  /** Nivel por el que va el jugador en el puzzle activo. */
  private puzzleLevel(): number {
    return this.puzzle === 'lights' ? this.progress.lightsLevel : this.progress.currentLevel;
  }

  /** Carga un nivel de Luces: el tablero de luces y un tablero «vacío» de Circuitos solo para reutilizar la geometría. */
  private loadLightsLevel(levelIndex: number): void {
    const params = lightsParamsForTier(this.profile.currentTier);
    const level: LightsLevel = generateLights(params, levelSeed((this.progress.seedBase ^ 0x9e3779b9) >>> 0, levelIndex));
    const size = params.size;
    this.currentParams = { width: size, height: size, extraLoops: 0, branchBias: 0 };
    this.lightGrid = cloneGrid(level.initial);
    this.lastLightsTap = null;
    const grid = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => ({ row, col, baseMask: 0, rotation: 0, isSource: false }))
    );
    this.board = { rows: size, cols: size, grid, source: { row: 0, col: 0 } };
    this.currentLevelData = {
      seed: level.seed,
      params: this.currentParams,
      board: this.board,
      solutionRotations: [],
      initialRotations: [],
      minTaps: level.minTaps,
      difficulty: 0,
      branches: 0,
      cycles: 0,
    };
  }

  private startLevel(levelIndex: number): void {
    this.loadLevel(levelIndex);

    // Guardar en qué nivel va el jugador para retomarlo al reabrir la app
    if (!this.isDaily && this.puzzleLevel() !== levelIndex) {
      this.progress = this.puzzle === 'lights' ? { ...this.progress, lightsLevel: levelIndex } : { ...this.progress, currentLevel: levelIndex };
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
      this.startLevel(this.puzzleLevel());
    } else {
      // El reto diario es de Circuitos: desde Luces cambia de puzzle
      if (this.puzzle === 'lights') this.setPuzzle('circuits', false);
      this.isDaily = true;
      this.dailyKey = dateKey(new Date());
      this.startLevel(1);
    }
  }

  /** Cambia de puzzle: lo guarda, rehace la interfaz (el panel del giro cambia) y, si se pide, arranca su nivel actual. */
  private setPuzzle(puzzle: PuzzleType, start = true): void {
    this.puzzle = puzzle;
    this.settings.puzzle = puzzle;
    storage.saveSettings(this.settings);
    this.isDaily = false;
    this.buildUi();
    if (start) this.startLevel(this.puzzleLevel());
    if (puzzle === 'lights' && start && !this.settings.hasSeenLightsTip) {
      this.settings.hasSeenLightsTip = true;
      storage.saveSettings(this.settings);
      this.showToast(t('Toca una casilla: cambia su luz y la de sus vecinas.\nEnciende todo el tablero.'));
    }
  }

  private toggleTheme(): void {
    const newThemeName = this.settings.theme === 'light' ? 'dark' : 'light';
    this.settings.theme = newThemeName;
    storage.saveSettings(this.settings);
    feedback.toggle();

    setActiveTheme(newThemeName, this.settings.highContrast, this.settings.skin);
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
        const img = this.add.image(0, 0, '__DEFAULT');

        container.add([img, hit]);
        container.setAngle(cell.rotation * 90);

        const view: CellView = { container, img, textureKey: '', cell, row: r, col: c, isRotating: false, glow: 0, hintRing: false };

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
   * Pone en la casilla la imagen que corresponde a su estado actual: vidrio redondeado, trazas apagadas
   * (finas) o filamento encendido (grueso, con halo y núcleo blanco-caliente). Todo es simétrico a 90°,
   * así que gira con el contenedor. La imagen se pinta una sola vez (ver `cellTextureKeys`).
   */
  private drawCell(view: CellView, powered: boolean): void {
    if (this.puzzle === 'lights' && !this.isDaily) {
      this.drawLightsCell(view, powered);
      return;
    }
    const { cellVisual, gap } = this.geometry;
    const half = cellVisual / 2;
    const bridge = half + gap / 2; // llega hasta la mitad del hueco para que los cables vecinos se toquen
    const isSource = view.cell.isSource;
    const dirs: Array<{ dir: Direction; dx: number; dy: number }> = [
      { dir: Direction.NORTH, dx: 0, dy: -1 },
      { dir: Direction.EAST, dx: 1, dy: 0 },
      { dir: Direction.SOUTH, dx: 0, dy: 1 },
      { dir: Direction.WEST, dx: -1, dy: 0 },
    ];

    const legs: CellLeg[] = dirs
      .filter((d) => hasDirection(view.cell.baseMask, d.dir))
      .map((d) => {
        const worldDir = ((d.dir + view.cell.rotation) % 4) as Direction;
        const delta = DIRECTION_DELTAS[worldDir];
        const nr = view.row + delta.dr;
        const nc = view.col + delta.dc;
        const hasNeighbor = nr >= 0 && nr < this.board.rows && nc >= 0 && nc < this.board.cols;
        return {
          dx: d.dx,
          dy: d.dy,
          // Hacia el borde del tablero el cable termina en el borde de la casilla, sin asomar
          reach: hasNeighbor ? bridge : half,
          lit: powered && isBranchConnected(this.board, view.row, view.col, worldDir),
        };
      });

    // El brillo solo se nota en casillas encendidas o en la fuente
    const glowStep = powered || isSource ? Math.round(Math.min(1, Math.max(0, view.glow)) * GLOW_STEPS) : 0;
    const marks = this.settings.litMarks && powered;
    const look: CellLook = { powered, isSource, hintRing: view.hintRing, glowStep, marks, legs };

    const prefix = `${this.settings.theme}${this.settings.highContrast ? '+hc' : ''}|${this.settings.skin}|${this.geometry.cellSize}|${cellVisual}`;
    const key =
      `cell|${prefix}|${powered ? 1 : 0}${isSource ? 1 : 0}${view.hintRing ? 1 : 0}${marks ? 1 : 0}|${glowStep}|` +
      legs.map((l) => `${l.dx},${l.dy},${l.reach === bridge ? 'b' : 'h'}${l.lit ? 'L' : 'o'}`).join(';');
    if (key === view.textureKey) return;

    this.ensureCellTexture(key, prefix, look);
    view.img.setTexture(key);
    view.textureKey = key;
  }

  /** Casilla de Luces: la textura depende de si está encendida, del brillo y de la pista (se pinta una sola vez). */
  private drawLightsCell(view: CellView, lit: boolean): void {
    const { cellVisual, cellSize } = this.geometry;
    const glowStep = lit ? Math.round(Math.min(1, Math.max(0, view.glow)) * GLOW_STEPS) : 0;
    const marks = this.settings.litMarks && lit;
    const look: CellLook = { powered: lit, isSource: false, hintRing: view.hintRing, glowStep, marks, legs: [], lights: true };
    const prefix = `L|${this.settings.theme}${this.settings.highContrast ? '+hc' : ''}|${this.settings.skin}|${cellSize}|${cellVisual}`;
    const key = `lcell|${prefix}|${lit ? 1 : 0}${view.hintRing ? 1 : 0}${marks ? 1 : 0}|${glowStep}`;
    if (key === view.textureKey) return;
    this.ensureCellTexture(key, prefix, look);
    view.img.setTexture(key);
    view.textureKey = key;
  }

  /** Pinta (una sola vez) la textura de un aspecto de casilla. */
  private ensureCellTexture(key: string, prefix: string, look: CellLook): void {
    if (prefix !== cellTexturePrefix) {
      // Cambió el tema o el tamaño del tablero: las texturas viejas ya no sirven
      for (const old of cellTextureKeys) if (this.textures.exists(old)) this.textures.remove(old);
      cellTextureKeys.clear();
      cellTexturePrefix = prefix;
    }
    if (this.textures.exists(key)) return;

    const size = this.geometry.cellSize + 2;
    const texture = this.textures.addDynamicTexture(key, size, size);
    if (!texture) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    this.paintCell(g, look);
    texture.draw(g, size / 2, size / 2);
    g.destroy();
    cellTextureKeys.add(key);
  }

  /** Dibuja el aspecto de una casilla centrado en (0, 0). */
  /** Casilla de Luces: vidrio con una cruz corta (ella y sus vecinas) y una lámpara en el centro. */
  private paintLightsCell(g: Phaser.GameObjects.Graphics, look: CellLook): void {
    const { cellVisual } = this.geometry;
    const half = cellVisual / 2;
    const radius = cellVisual * 0.17;
    const style = skinStyle(THEME.skin);
    const lit = look.powered;
    const glow = look.glowStep / GLOW_STEPS;

    g.fillStyle(mixColors(THEME.surface, THEME.primary, lit ? 0.12 + 0.2 * glow : 0), 1);
    fillTile(g, style, cellVisual, radius);
    g.lineStyle(2, lit ? mixColors(THEME.divider, THEME.primary, 0.55) : THEME.borderOff, 1);
    strokeTile(g, style, cellVisual, radius);
    if (look.hintRing) {
      g.lineStyle(5, THEME.hintRing, 1);
      strokeTile(g, style, cellVisual, radius, 3);
    }
    if (look.marks) {
      const inset = cellVisual * 0.12;
      const dot = Math.max(4, cellVisual * 0.045);
      g.fillStyle(THEME.primary, 1);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.fillCircle(sx * (half - inset), sy * (half - inset), dot);
    }

    const w = Math.max(8, cellVisual * 0.12) * style.wireScale;
    const reach = half * 0.62;
    const legs = [
      { dx: 0, dy: -1, reach },
      { dx: 1, dy: 0, reach },
      { dx: 0, dy: 1, reach },
      { dx: -1, dy: 0, reach },
    ];
    if (lit) {
      for (const [scale, alpha] of [[3.1, 0.06], [2.2, 0.1], [1.55, 0.16]] as const) {
        for (const leg of legs) {
          g.lineStyle(w * scale * (0.6 + 0.4 * style.halo), THEME.primary, Math.min(1, (alpha + 0.12 * glow) * style.halo));
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(leg.dx * leg.reach, leg.dy * leg.reach);
          g.strokePath();
        }
      }
      for (const leg of legs) strokeLitLeg(g, style, THEME, leg, w, glow);
      g.fillStyle(THEME.primary, Math.min(1, (0.22 + 0.3 * glow) * Math.min(1.4, style.halo)));
      g.fillCircle(0, 0, w * 2.1);
      fillNode(g, style, w * 1.35, THEME.primary);
      fillNode(g, style, w * 0.6, THEME.energyCore);
    } else {
      for (const leg of legs) {
        g.lineStyle(w * 0.7, THEME.wireOff, 1);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(leg.dx * leg.reach, leg.dy * leg.reach);
        g.strokePath();
      }
      fillNode(g, style, w * 0.8, THEME.wireOffHub);
    }
  }

  private paintCell(g: Phaser.GameObjects.Graphics, look: CellLook): void {
    if (look.lights) {
      this.paintLightsCell(g, look);
      return;
    }
    const { cellVisual } = this.geometry;
    const half = cellVisual / 2;
    const radius = cellVisual * 0.17;
    const { powered, isSource, legs } = look;
    const glow = look.glowStep / GLOW_STEPS;
    const style = skinStyle(THEME.skin);

    // Casilla de vidrio: se tiñe de calor cuando está energizada
    const tint = powered ? 0.1 + 0.16 * glow : 0;
    g.fillStyle(mixColors(THEME.surface, isSource ? THEME.accent : THEME.primary, tint), 1);
    fillTile(g, style, cellVisual, radius);
    const edge = isSource ? THEME.accent : powered ? mixColors(THEME.divider, THEME.primary, 0.55) : THEME.borderOff;
    g.lineStyle(isSource ? 3 : 2, edge, 1);
    strokeTile(g, style, cellVisual, radius);

    // Anillo de la pista
    if (look.hintRing) {
      g.lineStyle(5, THEME.hintRing, 1);
      strokeTile(g, style, cellVisual, radius, 3);
    }

    // Marcas de "encendida": cuatro puntos en las esquinas (iguales girando la pieza, no dependen del color)
    if (look.marks) {
      const inset = cellVisual * 0.12;
      const dot = Math.max(4, cellVisual * 0.045);
      g.fillStyle(isSource ? THEME.accent : THEME.primary, 1);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.fillCircle(sx * (half - inset), sy * (half - inset), dot);
    }

    const w = Math.max(8, cellVisual * 0.12) * style.wireScale;
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
        g.lineStyle(w * scale * (0.6 + 0.4 * style.halo), THEME.primary, Math.min(1, (alpha + 0.12 * glow) * style.halo));
        stroke(leg);
      }
    }
    for (const leg of lit) strokeLitLeg(g, style, THEME, leg, w, glow);

    // Nodo central
    if (isSource) {
      g.fillStyle(THEME.accent, (0.2 + 0.2 * glow) * Math.min(1.4, style.halo));
      g.fillCircle(0, 0, w * 2.7);
      fillNode(g, style, w * 1.5, THEME.accent);
      fillNode(g, style, w * 0.75, THEME.energyCore);
    } else if (powered) {
      g.fillStyle(THEME.primary, (0.2 + 0.3 * glow) * Math.min(1.4, style.halo));
      g.fillCircle(0, 0, w * 1.7);
      fillNode(g, style, w * 0.95, THEME.primary);
      fillNode(g, style, w * 0.42, THEME.energyCore);
    } else {
      fillNode(g, style, w * 0.75, THEME.wireOffHub);
    }
  }

  private updateFlowVisuals(): void {
    if (this.puzzle === 'lights' && !this.isDaily) {
      let lit = 0;
      for (let r = 0; r < this.board.rows; r++) {
        for (let c = 0; c < this.board.cols; c++) {
          const on = this.lightGrid[r][c];
          this.drawCell(this.cellViews[r][c], on);
          if (on) lit++;
        }
      }
      const total = this.board.rows * this.board.cols;
      feedback.setIntensity(total > 0 ? lit / total : 0);
      return;
    }
    const powered = computePowerFlow(this.board);
    let lit = 0;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        this.drawCell(this.cellViews[r][c], powered[r][c]);
        if (powered[r][c]) lit++;
      }
    }
    // La música gana capas a medida que el circuito se enciende (la fuente, sola, cuenta como 0)
    const total = this.board.rows * this.board.cols;
    feedback.setIntensity(total > 1 ? (lit - 1) / (total - 1) : 0);
  }

  /**
   * @param invert true cuando se usa el clic derecho: gira en el sentido contrario al seleccionado.
   */
  private handleCellTap(view: CellView, invert = false): void {
    if (this.puzzle === 'lights' && !this.isDaily) {
      this.handleLightsTap(view);
      return;
    }
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
    const poweredBefore = this.poweredCount();
    rotateCell(this.board, view.row, view.col, step);

    // Sonido y vibración: la nota de la casilla y, si el giro enciende algo nuevo, una campanita
    feedback.rotate(view.row, view.col);
    if (this.poweredCount() > poweredBefore) feedback.connected(view.row, view.col);

    // Animación fluida de giro
    const targetAngle = view.container.angle + step * 90;

    this.tweens.add({
      targets: view.container,
      angle: targetAngle,
      duration: this.dur(170),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        view.isRotating = false;
        this.updateFlowVisuals();
        this.evaluateVictory();
      },
    });

    this.updateFlowVisuals();
  }

  /** Toque en Luces: cambia la casilla y sus vecinas; las que se encienden destellan. */
  private handleLightsTap(view: CellView): void {
    if (this.isWon) return;
    this.tapCount++;
    this.moveHistory.push({ row: view.row, col: view.col, step: 0 });
    this.updateHud();
    this.updateUndoButtonState();
    this.applyLightsToggle(view.row, view.col, true);
    this.evaluateVictory();
  }

  /** Cambia las luces de una casilla y sus vecinas con su sonido y destello. `forward` = jugada (no deshacer). */
  private applyLightsToggle(row: number, col: number, forward: boolean): void {
    const before = litCount(this.lightGrid);
    toggleLights(this.lightGrid, row, col);
    this.lastLightsTap = { row, col };
    if (forward) {
      feedback.rotate(row, col);
      if (litCount(this.lightGrid) > before) feedback.connected(row, col);
    } else {
      feedback.undo(row, col);
    }
    const affected: Array<[number, number]> = [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    for (const [r, c] of affected) {
      const view = this.cellViews[r]?.[c];
      if (!view) continue;
      if (this.lightGrid[r][c] && !this.reducedMotion()) {
        this.tweens.addCounter({
          from: 1,
          to: 0,
          duration: this.dur(300),
          ease: 'Sine.easeOut',
          onUpdate: (tween) => {
            view.glow = tween.getValue() ?? 0;
            if (this.cellViews[r]?.[c] === view) this.drawCell(view, this.lightGrid[r][c]);
          },
          onComplete: () => {
            view.glow = 0;
            if (this.cellViews[r]?.[c] === view) this.drawCell(view, this.lightGrid[r][c]);
          },
        });
      }
    }
    const tapped = this.cellViews[row]?.[col];
    if (tapped && !this.reducedMotion()) {
      tapped.container.setScale(0.9);
      this.tweens.add({ targets: tapped.container, scale: 1, duration: this.dur(160), ease: 'Back.easeOut' });
    }
    this.updateFlowVisuals();
  }

  private handleUndo(): void {
    if (this.isWon || this.moveHistory.length === 0) return;

    if (this.puzzle === 'lights' && !this.isDaily) {
      const last = this.moveHistory.pop()!;
      this.updateUndoButtonState();
      this.applyLightsToggle(last.row, last.col, false);
      return;
    }

    const lastMove = this.moveHistory[this.moveHistory.length - 1];
    const view = this.cellViews[lastMove.row][lastMove.col];

    // Si la pieza aún está girando se ignora el toque sin perder la jugada del historial
    if (view.isRotating) return;

    this.moveHistory.pop();
    this.updateUndoButtonState();
    feedback.undo(lastMove.row, lastMove.col);

    view.isRotating = true;
    // Deshacer gira en el sentido contrario al de la jugada original
    rotateCell(this.board, lastMove.row, lastMove.col, -lastMove.step);

    const targetAngle = view.container.angle - lastMove.step * 90;
    this.tweens.add({
      targets: view.container,
      angle: targetAngle,
      duration: this.dur(150),
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
    if (this.puzzle === 'lights' && !this.isDaily) {
      this.useLightsHint();
      return;
    }

    const target = findHintCell(this.board);
    if (!target) {
      this.showToast(t('Todo está bien colocado.'));
      return;
    }

    const view = this.cellViews[target.row][target.col];
    if (view.isRotating) return; // espera a que termine el giro; no se cobra

    const afterPurchase = spendSparks(this.progress, HINT_COST);
    if (!afterPurchase) {
      feedback.denied();
      this.showToast(t('Necesitas {0} Chispas para una pista.\nResuelve niveles para ganar más.', HINT_COST));
      return;
    }

    this.progress = afterPurchase;
    storage.saveProgress(this.progress);
    this.hintsUsed++;
    feedback.hint();

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
      duration: this.dur(260),
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

  /** Pista en Luces: por 10 Chispas toca por ti la casilla que más acerca a la solución más corta. */
  private useLightsHint(): void {
    const target = lightsHint(this.lightGrid);
    if (!target) {
      this.showToast(t('Todo está encendido.'));
      return;
    }
    const afterPurchase = spendSparks(this.progress, HINT_COST);
    if (!afterPurchase) {
      feedback.denied();
      this.showToast(t('Necesitas {0} Chispas para una pista.\nResuelve niveles para ganar más.', HINT_COST));
      return;
    }
    this.progress = afterPurchase;
    storage.saveProgress(this.progress);
    this.hintsUsed++;
    feedback.hint();
    // La pista altera el tablero: el historial de deshacer anterior ya no sería coherente
    this.moveHistory = [];
    this.updateUndoButtonState();
    this.updateHud();
    this.updateHintButtonState();

    const [row, col] = target;
    const view = this.cellViews[row][col];
    view.hintRing = true;
    this.applyLightsToggle(row, col, true);
    this.evaluateVictory();
    // El anillo se mantiene un instante para que se vea qué casilla se tocó
    this.time.delayedCall(1000, () => {
      if (this.cellViews[row]?.[col] !== view) return;
      view.hintRing = false;
      this.drawCell(view, this.lightGrid[row]?.[col] ?? false);
    });
  }

  /** Pulso de luz que recorre el tablero desde la fuente. Devuelve su duración total en ms. */
  private playWinPulse(): number {
    if (this.reducedMotion()) return 0;

    const lightsMode = this.puzzle === 'lights' && !this.isDaily;
    const { rows, cols } = this.board;
    // En Luces la onda sale de la última casilla tocada y todo el tablero acaba encendido
    const source = lightsMode ? (this.lastLightsTap ?? { row: rows >> 1, col: cols >> 1 }) : this.board.source;
    const powered = lightsMode ? this.board.grid.map((row) => row.map(() => true)) : computePowerFlow(this.board);
    let maxDelay = 0;
    const maxStep = lightsMode
      ? Math.max(source.row, rows - 1 - source.row) + Math.max(source.col, cols - 1 - source.col)
      : rows - 1 - source.row + (cols - 1 - source.col);
    // Una nota por cada paso de la onda de luz: la melodía asciende con ella
    for (let step = 0; step <= maxStep; step++) {
      this.time.delayedCall(step * PULSE_STEP_MS, () => feedback.winStep(step));
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const view = this.cellViews[r][c];
        const delay = (Math.abs(r - source.row) + Math.abs(c - source.col)) * PULSE_STEP_MS;
        maxDelay = Math.max(maxDelay, delay);

        this.time.delayedCall(delay, () => {
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: this.dur(240),
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
    const solved = this.puzzle === 'lights' && !this.isDaily ? isAllLit(this.lightGrid) : checkVictory(this.board);
    if (!solved) return;

    this.isWon = true;
    this.updateUndoButtonState();
    this.updateHintButtonState();
    if (this.timerEvent) this.timerEvent.paused = true;

    const today = dateKey(new Date());
    const minTaps = this.currentLevelData.minTaps;
    const lightsMode = this.puzzle === 'lights' && !this.isDaily;
    const playedTier = this.isDaily ? dailyTier(this.dailyKey) : this.profile.currentTier;
    const recordKey = lightsMode ? lightsRecordKey(playedTier) : String(playedTier);

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
      this.hintsUsed === 0 && isNewTimeRecord(this.progress, playedTier, this.elapsedTime, recordKey);

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
      recordKey,
    });
    if (!this.isDaily) {
      // Al ganar, el jugador retoma en el siguiente nivel si cierra la app
      this.progress = lightsMode
        ? { ...this.progress, lightsLevel: this.currentLevelIndex + 1 }
        : { ...this.progress, currentLevel: this.currentLevelIndex + 1 };
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

    // Primero la luz recorre el circuito (con su melodía); después suena el acorde y aparece el resultado
    const pulseMs = this.playWinPulse();
    this.time.delayedCall(Math.max(0, pulseMs - 360), () => feedback.win());
    this.time.delayedCall(Math.min(1100, pulseMs * 0.8), () => this.showVictoryModal(evaluation, info));
  }

  private showVictoryModal(evaluation: PerformanceEvaluation, info: VictoryInfo): void {
    const { reward } = info;

    const minTaps = this.currentLevelData.minTaps;
    const efficiency = Math.round(evaluation.tapEfficiency * 100);
    const rows: Array<{ label: string; value: string; color?: string; icon?: IconKind }> = [
      { label: t('Tiempo'), value: this.formatTime(this.elapsedTime), color: info.isNewRecord ? THEME.primaryCss : undefined },
    ];
    if (info.isNewRecord) rows.push({ label: t('Récord personal'), value: t('Nuevo'), color: THEME.primaryCss });
    rows.push({ label: t('Toques'), value: t('{0}  (mínimo {1})', this.tapCount, minTaps) });
    rows.push({ label: this.hintsUsed > 0 ? t('Eficiencia (sin pistas)') : t('Eficiencia'), value: this.hintsUsed > 0 ? '—' : `${efficiency} %` });
    if (this.hintsUsed > 0) rows.push({ label: t('Pistas usadas'), value: String(this.hintsUsed) });
    if (info.difficultyChange) {
      rows.push({
        label: t('Dificultad'),
        value: info.difficultyChange === 'up' ? t('Sube un nivel') : t('Baja un nivel'),
      });
    }
    rows.push(
      info.isDaily && !info.firstDailyToday
        ? { label: t('Chispas'), value: t('Ya cobradas hoy') }
        : {
            label: reward.multiplier === 2 ? t('Chispas (doble por el reto)') : t('Chispas'),
            value: `+${reward.total}`,
            color: THEME.primaryCss,
            icon: 'spark',
          }
    );
    if (info.streak > 0) {
      rows.push({
        label: t('Racha'),
        value: t(info.streak === 1 ? '{0} día' : '{0} días', info.streak),
        color: info.streakIncreased ? THEME.primaryCss : undefined,
      });
    }

    // La tarjeta se ajusta a la cantidad de filas
    const breakdownH = reward.total > 0 ? 84 : 24;
    const cardH = 200 + rows.length * 58 + breakdownH + 270;
    const { overlay, w, backdrop } = this.createCard(cardH, 200);
    overlay.setAlpha(0);

    // Siguiente nivel con un solo gesto: botón, toque fuera de la tarjeta o Enter / Espacio
    let armed = false;
    const goNext = () => {
      if (!armed || !overlay.active) return;
      overlay.destroy();
      if (info.isDaily) {
        this.isDaily = false;
        this.startLevel(this.puzzleLevel());
      } else {
        this.startLevel(this.currentLevelIndex + 1);
      }
    };
    // Se arma tras un instante para que un toque accidental no se salte el resultado
    this.time.delayedCall(700, () => (armed = true));
    backdrop.on('pointerdown', goNext);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', goNext);
    keyboard?.on('keydown-SPACE', goNext);
    overlay.once('destroy', () => {
      keyboard?.off('keydown-ENTER', goNext);
      keyboard?.off('keydown-SPACE', goNext);
    });

    overlay.add(this.uiText(0, -cardH / 2 + 70, this.puzzle === 'lights' && !info.isDaily ? t('Todo encendido') : t('Circuito completo'), { size: 34, display: true, color: THEME.primaryCss, originX: 0.5 }));
    overlay.add(
      this.uiText(0, -cardH / 2 + 124, info.isDaily ? t('Reto diario superado') : t('Nivel {0} superado', this.currentLevelIndex), {
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
            t('Base {0}', reward.base),
            reward.efficiencyBonus > 0 ? t('eficiencia {0}', reward.efficiencyBonus) : '',
            reward.speedBonus > 0 ? t('rapidez {0}', reward.speedBonus) : '',
            reward.recordBonus > 0 ? t('récord {0}', reward.recordBonus) : '',
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
      info.isDaily ? t('Volver al juego') : t('Siguiente nivel'),
      () => {
        armed = true;
        goNext();
      },
      true
    );

    this.addCardButton(
      overlay,
      { x: 0, y: cardH / 2 - 80, w: w - 88, h: 92 },
      info.isDaily ? t('Repetir el reto') : t('Repetir este nivel'),
      () => {
        overlay.destroy();
        this.startLevel(this.currentLevelIndex);
      },
      false
    );

    this.tweens.add({ targets: overlay, alpha: 1, duration: this.dur(320), ease: 'Power2' });
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
