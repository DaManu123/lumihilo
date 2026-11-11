import Phaser from 'phaser';
import type { BurstKind, FxLevel, SkinFx } from '../core/graphics';
import type { GameTheme } from './theme';

/**
 * Efectos de los gráficos altos (ver `core/graphics.ts`): textura animada, partículas de ambiente, luz detrás del
 * tablero, viñeta y destellos. Todo se pinta una vez en texturas pequeñas y blancas que se tiñen con el color del
 * aspecto; las partículas tienen tope de cantidad. Solo se usa con WebGL.
 */

type G = Phaser.GameObjects.Graphics;

/** Profundidades: el fondo del aspecto está en −101…−99; esto va encima de él y debajo del juego. */
const DEPTH_SHEEN = -98;
const DEPTH_AMBIENT = -97;
/** Destellos: encima del tablero y bajo el menú (90) y las tarjetas (≥ 100). */
export const DEPTH_BURST = 60;

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: G) => void): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.addDynamicTexture(key, w, h);
  if (!texture) return '__WHITE';
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(g);
  texture.draw(g, 0, 0);
  g.destroy();
  return key;
}

/** Punto de luz blanco de borde suave (se tiñe al usarlo). */
function softDot(scene: Phaser.Scene): string {
  return makeTexture(scene, 'fx|dot', 32, 32, (g) => {
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0xffffff, 0.1 + i * 0.07);
      g.fillCircle(16, 16, 16 - i * 1.5);
    }
  });
}

/** Destello de cuatro puntas (estrellas y chispas). */
function starTexture(scene: Phaser.Scene): string {
  return makeTexture(scene, 'fx|star', 48, 48, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(24, 24, 7);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(24, 0, 21, 24, 27, 24);
    g.fillTriangle(24, 48, 21, 24, 27, 24);
    g.fillTriangle(0, 24, 24, 21, 24, 27);
    g.fillTriangle(48, 24, 24, 21, 24, 27);
    g.fillCircle(24, 24, 4);
  });
}

/** Cuadradito de datos (Matrix). */
function bitTexture(scene: Phaser.Scene): string {
  return makeTexture(scene, 'fx|bit', 12, 12, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(1, 1, 10, 10);
  });
}

/** Aro de burbuja (Océano). */
function ringTexture(scene: Phaser.Scene): string {
  return makeTexture(scene, 'fx|ring', 40, 40, (g) => {
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(20, 20, 16);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(20, 20, 16);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(14, 14, 3);
  });
}

/** Hoja de símbolos verdes (Matrix): cada símbolo es un fotograma de la misma textura. */
function glyphSheet(scene: Phaser.Scene): { key: string; frames: string[] } {
  const key = 'fx|glyphs';
  const glyphs = '01ABCDEF<>=+*:';
  const frames = [...glyphs].map((_, i) => `g${i}`);
  if (scene.textures.exists(key)) return { key, frames };
  const cell = 32;
  const texture = scene.textures.addDynamicTexture(key, cell * glyphs.length, cell);
  if (!texture) return { key: softDot(scene), frames: [] };
  [...glyphs].forEach((ch, i) => {
    const text = scene.make.text({
      x: 0,
      y: 0,
      text: ch,
      style: { fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' },
      add: false,
    });
    text.setOrigin(0.5);
    texture.draw(text, i * cell + cell / 2, cell / 2);
    text.destroy();
    texture.add(`g${i}`, 0, i * cell, 0, cell, cell);
  });
  return { key, frames };
}

function particleTexture(scene: Phaser.Scene, kind: BurstKind): string {
  switch (kind) {
    case 'stars':
    case 'spark':
      return starTexture(scene);
    case 'bits':
      return bitTexture(scene);
    case 'bubbles':
      return ringTexture(scene);
    default:
      return softDot(scene);
  }
}

// ---------------------------------------------------------------------------
// Texturas animadas a pantalla completa
// ---------------------------------------------------------------------------

/**
 * Líneas de escaneo finas que bajan sin parar (Cyberpunk; Matrix las usa más marcadas, como un monitor CRT).
 * Es una sola imagen del tamaño de la pantalla (sin mosaicos, que en algunos WebGL dejan costuras): como las
 * líneas se repiten cada `period` píxeles, bajarla un periodo y volver a empezar no se nota.
 */
function scanlines(scene: Phaser.Scene, w: number, h: number, color: number, alpha: number, animate: boolean, out: FxParts): void {
  const period = 6;
  const key = makeTexture(scene, `fx|scan|${w}x${h}`, w, h + period, (g) => {
    g.fillStyle(0xffffff, 1);
    for (let y = 0; y < h + period; y += period) g.fillRect(0, y, w, 2);
  });
  const lines = scene.add.image(0, -period, key).setOrigin(0).setDepth(DEPTH_SHEEN).setTint(color).setAlpha(alpha);
  out.objects.push(lines);
  if (animate) out.tweens.push(scene.tweens.add({ targets: lines, y: 0, duration: 900, repeat: -1, ease: 'Linear' }));
}

/** Cáusticas: la red de luz que forma el agua, en dos capas que se mecen en sentidos distintos (Océano). */
function caustics(scene: Phaser.Scene, w: number, h: number, color: number, blend: number, animate: boolean, out: FxParts): void {
  const tw = w + 120;
  const th = Math.round(h * 0.8);
  const layers = [
    { seed: 9001, alpha: 0.16, dx: 60, dy: 30, ms: 9000 },
    { seed: 4711, alpha: 0.12, dx: -60, dy: 45, ms: 12000 },
  ];
  for (const layer of layers) {
    const key = makeTexture(scene, `fx|caustic|${layer.seed}|${w}x${h}`, tw, th, (g) => {
      let seed = layer.seed;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * tw;
        const y = rnd() * th;
        const rx = 30 + rnd() * 60;
        const ry = 20 + rnd() * 40;
        g.lineStyle(2 + rnd() * 4, 0xffffff, 0.3 + rnd() * 0.5 * (1 - y / th));
        g.strokeEllipse(x, y, rx * 2, ry * 2);
      }
    });
    const sprite = scene.add.image(-60, 0, key).setOrigin(0).setDepth(DEPTH_SHEEN).setTint(color).setAlpha(layer.alpha).setBlendMode(blend);
    out.objects.push(sprite);
    if (animate) {
      out.tweens.push(
        scene.tweens.add({ targets: sprite, x: -60 + layer.dx, y: layer.dy, duration: layer.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      );
      out.tweens.push(scene.tweens.add({ targets: sprite, alpha: layer.alpha * 0.4, duration: layer.ms / 3, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
  }
}

/** Corona: un sol de luz detrás del centro que late, con un núcleo más caliente (Solar). */
function corona(scene: Phaser.Scene, w: number, h: number, theme: GameTheme, blend: number, animate: boolean, out: FxParts): void {
  const glowKey = makeTexture(scene, 'fx|corona', 256, 256, (g) => {
    for (let i = 0; i < 24; i++) {
      g.fillStyle(0xffffff, 0.022);
      g.fillCircle(128, 128, 128 - i * 5);
    }
  });
  const cx = w / 2;
  const cy = h * 0.56;
  const glow = scene.add.image(cx, cy, glowKey).setDepth(DEPTH_SHEEN).setTint(theme.accent).setScale((w * 1.5) / 256).setAlpha(0.55).setBlendMode(blend);
  // Núcleo más pequeño y caliente que late a contratiempo
  const core = scene.add.image(cx, cy, glowKey).setDepth(DEPTH_SHEEN).setTint(theme.primary).setScale((w * 0.7) / 256).setAlpha(0.35).setBlendMode(blend);
  out.objects.push(glow, core);
  if (animate) {
    out.tweens.push(scene.tweens.add({ targets: core, alpha: 0.6, scale: core.scale * 1.12, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    out.tweens.push(scene.tweens.add({ targets: glow, alpha: 0.32, scale: glow.scale * 0.9, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  }
}

/** Velo de luz: una banda diagonal que cruza la pantalla y, de vez en cuando, una estrella fugaz (Aurora). */
function shimmer(scene: Phaser.Scene, w: number, h: number, theme: GameTheme, blend: number, animate: boolean, out: FxParts): void {
  const bandKey = makeTexture(scene, 'fx|band', 256, 64, (g) => {
    for (let i = 0; i < 32; i++) {
      g.fillStyle(0xffffff, 0.02 + 0.03 * Math.sin((i / 31) * Math.PI));
      g.fillRect(i * 8, 0, 8, 64);
    }
  });
  const band = scene.add
    .image(-w, h * 0.3, bandKey)
    .setDepth(DEPTH_SHEEN)
    .setTint(theme.accent)
    .setDisplaySize(w * 1.1, h * 1.6)
    .setAngle(18)
    .setAlpha(animate ? 0.9 : 0)
    .setBlendMode(blend);
  out.objects.push(band);
  if (!animate) return;
  out.tweens.push(scene.tweens.add({ targets: band, x: w * 2, duration: 9000, repeatDelay: 5000, repeat: -1, ease: 'Sine.easeInOut' }));

  const streakKey = makeTexture(scene, 'fx|streak', 128, 6, (g) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle(0xffffff, (i / 15) * 0.9);
      g.fillRect(i * 8, 1, 8, 4);
    }
  });
  const streak = scene.add.image(0, 0, streakKey).setDepth(DEPTH_AMBIENT).setTint(theme.energyCore).setAlpha(0).setBlendMode(blend);
  out.objects.push(streak);
  const shoot = () => {
    if (!streak.active) return;
    const x0 = w * (0.15 + Math.random() * 0.6);
    const y0 = h * (0.05 + Math.random() * 0.3);
    streak.setPosition(x0, y0).setAngle(24).setAlpha(0);
    scene.tweens.add({ targets: streak, x: x0 + 300, y: y0 + 134, duration: 900, ease: 'Quad.easeIn' });
    scene.tweens.add({ targets: streak, alpha: 0.9, duration: 300, yoyo: true, hold: 300 });
  };
  out.timers.push(scene.time.addEvent({ delay: 7000, loop: true, callback: shoot }));
}

// ---------------------------------------------------------------------------
// Partículas de ambiente
// ---------------------------------------------------------------------------

function ambient(scene: Phaser.Scene, fx: SkinFx, theme: GameTheme, w: number, h: number, blend: number, out: FxParts): void {
  const count = fx.ambientCount;
  const tints = [theme.primary, theme.accent, theme.energyCore];
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  switch (fx.ambient) {
    case 'neon': {
      // Polvo de neón que sube despacio y parpadea
      const lifespan = 9000;
      emitter = scene.add.particles(0, 0, softDot(scene), {
        x: { min: 0, max: w },
        y: { min: h * 0.2, max: h },
        lifespan,
        speedY: { min: -40, max: -14 },
        speedX: { min: -8, max: 8 },
        scale: { min: 0.3, max: 0.85 },
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * (0.55 + 0.45 * Math.sin(t * 40)) },
        tint: [theme.primary, theme.accent],
        blendMode: blend,
        frequency: lifespan / count,
        maxAliveParticles: count,
      });
      break;
    }
    case 'glyphs': {
      // Símbolos sueltos que caen por delante de la lluvia de código
      const sheet = glyphSheet(scene);
      const lifespan = 7000;
      emitter = scene.add.particles(0, 0, sheet.key, {
        frame: sheet.frames.length ? sheet.frames : undefined,
        x: { min: 0, max: w },
        y: -20,
        lifespan,
        speedY: { min: 120, max: 260 },
        scale: { min: 0.6, max: 1 },
        alpha: { start: 0.9, end: 0 },
        tint: [theme.primary, theme.energyCore],
        blendMode: blend,
        frequency: lifespan / count / 1.5,
        maxAliveParticles: count,
      });
      break;
    }
    case 'motes': {
      // Plancton luminoso que deriva en el agua
      const lifespan = 10000;
      emitter = scene.add.particles(0, 0, softDot(scene), {
        x: { min: 0, max: w },
        y: { min: 0, max: h },
        lifespan,
        speedX: { min: -12, max: 12 },
        speedY: { min: -18, max: 6 },
        scale: { min: 0.18, max: 0.5 },
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.75 },
        tint: [theme.energyCore, theme.primary],
        blendMode: blend,
        frequency: lifespan / count,
        maxAliveParticles: count,
      });
      break;
    }
    case 'embers': {
      // Brasas que suben desde abajo y se apagan
      const lifespan = 6500;
      emitter = scene.add.particles(0, 0, softDot(scene), {
        x: { min: 0, max: w },
        y: h + 10,
        lifespan,
        speedY: { min: -170, max: -70 },
        speedX: { min: -25, max: 25 },
        accelerationX: { min: -10, max: 10 },
        scale: { start: 0.7, end: 0.05 },
        alpha: { start: 1, end: 0 },
        tint: [theme.accent, theme.primary, theme.energyCore],
        blendMode: blend,
        frequency: lifespan / count,
        maxAliveParticles: count,
      });
      break;
    }
    default: {
      // Estrellas que titilan en el cielo de la aurora
      const lifespan = 4000;
      emitter = scene.add.particles(0, 0, starTexture(scene), {
        x: { min: 0, max: w },
        y: { min: 0, max: h * 0.85 },
        lifespan,
        scale: { min: 0.2, max: 0.6 },
        rotate: { min: 0, max: 45 },
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) },
        tint: tints,
        blendMode: blend,
        frequency: lifespan / count,
        maxAliveParticles: count,
      });
    }
  }
  emitter.setDepth(DEPTH_AMBIENT);
  // Arranca con el ambiente ya poblado, sin esperar a que nazcan una a una
  emitter.fastForward(6000);
  out.objects.push(emitter);
}

// ---------------------------------------------------------------------------
// Conjunto
// ---------------------------------------------------------------------------

interface FxParts {
  objects: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
  timers: Phaser.Time.TimerEvent[];
}

export interface SkinFxRuntime {
  /** Destello en un punto (al tocar o conectar). `power` 0-1 escala la cantidad. */
  burst(x: number, y: number, power?: number): void;
  /** Celebración de la victoria sobre el rectángulo del tablero. */
  celebrate(rect: { x: number; y: number; w: number; h: number }): void;
  destroy(): void;
}

/**
 * Monta los efectos del aspecto: textura animada, ambiente, viñeta en la cámara y los emisores de destellos.
 * Con `level === 'static'` (sin animaciones) solo pone lo que no se mueve.
 */
export function buildSkinFx(scene: Phaser.Scene, fx: SkinFx, theme: GameTheme, level: FxLevel): SkinFxRuntime {
  const { width: w, height: h } = scene.cameras.main;
  const animate = level === 'full';
  const dark = theme.name === 'dark';
  // En el tema claro la luz aditiva se perdería sobre el fondo: se mezcla normal y más suave
  const blend = dark ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
  const parts: FxParts = { objects: [], tweens: [], timers: [] };

  switch (fx.sheen) {
    case 'scanlines':
      scanlines(scene, w, h, theme.primary, dark ? 0.06 : 0.04, animate, parts);
      break;
    case 'crt':
      scanlines(scene, w, h, theme.primary, dark ? 0.1 : 0.05, animate, parts);
      break;
    case 'caustics':
      caustics(scene, w, h, theme.energyCore, blend, animate, parts);
      break;
    case 'heat':
      corona(scene, w, h, theme, blend, animate, parts);
      break;
    case 'shimmer':
      shimmer(scene, w, h, theme, blend, animate, parts);
      break;
  }
  if (animate) ambient(scene, fx, theme, w, h, blend, parts);

  const vignette = scene.cameras.main.postFX.addVignette(0.5, 0.5, 0.85, fx.vignette * (dark ? 1 : 0.5));

  // Emisor de destellos reutilizable (no se crea uno por toque)
  let burster: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  if (animate) {
    const kind = fx.burst;
    const rising = kind === 'bubbles' || kind === 'embers';
    burster = scene.add.particles(0, 0, particleTexture(scene, kind), {
      emitting: false,
      lifespan: { min: 380, max: 760 },
      speed: { min: 90, max: kind === 'bits' ? 320 : 260 },
      gravityY: rising ? -260 : kind === 'bits' ? 420 : 0,
      scale: kind === 'bubbles' ? { start: 0.5, end: 0.2 } : kind === 'bits' ? { start: 1, end: 0.4 } : { start: 0.7, end: 0 },
      rotate: kind === 'stars' || kind === 'spark' ? { min: 0, max: 90 } : 0,
      alpha: { start: 1, end: 0 },
      tint: kind === 'embers' ? [theme.accent, theme.energyCore] : [theme.primary, theme.energyCore, theme.accent],
      blendMode: blend,
    });
    burster.setDepth(DEPTH_BURST);
    parts.objects.push(burster);
  }

  return {
    burst(x, y, power = 1) {
      if (!burster?.active) return;
      burster.explode(Math.max(2, Math.round(10 * power)), x, y);
    },
    celebrate(rect) {
      if (!burster?.active) return;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      // Onda de luz que sale del centro del tablero
      const ringKey = makeTexture(scene, 'fx|shock', 256, 256, (g) => {
        g.lineStyle(10, 0xffffff, 0.9);
        g.strokeCircle(128, 128, 118);
        g.lineStyle(22, 0xffffff, 0.18);
        g.strokeCircle(128, 128, 108);
      });
      const ring = scene.add.image(cx, cy, ringKey).setDepth(DEPTH_BURST).setTint(theme.energyCore).setBlendMode(blend).setScale(0.1).setAlpha(1);
      scene.tweens.add({
        targets: ring,
        scale: (Math.max(rect.w, rect.h) * 1.5) / 256,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
      // Destellos en cascada por todo el tablero
      for (let i = 0; i < 7; i++) {
        scene.time.delayedCall(i * 110, () => {
          if (!burster?.active) return;
          burster.explode(12, rect.x + Math.random() * rect.w, rect.y + Math.random() * rect.h);
        });
      }
      burster.explode(24, cx, cy);
    },
    destroy() {
      for (const tween of parts.tweens) tween.stop();
      for (const timer of parts.timers) timer.remove();
      for (const object of parts.objects) object.destroy();
      scene.cameras.main.postFX.remove(vignette);
      burster = null;
    },
  };
}

/**
 * Luz detrás del tablero: un halo del color del aspecto que late despacio. Se añade dentro del contenedor del
 * tablero, al fondo, para que se mueva y se oculte con él.
 */
export function addBackLight(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  theme: GameTheme,
  rect: { x: number; y: number; w: number; h: number },
  intensity: number,
  animate: boolean
): Phaser.Tweens.Tween | null {
  const key = makeTexture(scene, 'fx|backlight', 256, 256, (g) => {
    for (let i = 0; i < 26; i++) {
      g.fillStyle(0xffffff, 0.02);
      g.fillCircle(128, 128, 128 - i * 4.8);
    }
  });
  const dark = theme.name === 'dark';
  const alpha = intensity * (dark ? 1 : 0.5);
  const light = scene.add
    .image(rect.x + rect.w / 2, rect.y + rect.h / 2, key)
    .setTint(theme.primary)
    .setScale((Math.max(rect.w, rect.h) * 1.9) / 256)
    .setAlpha(alpha)
    .setBlendMode(dark ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
  container.addAt(light, 0);
  if (!animate) return null;
  return scene.tweens.add({ targets: light, alpha: alpha * 0.55, scale: light.scale * 0.94, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
