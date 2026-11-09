import Phaser from 'phaser';
import { GameTheme, SkinStyle } from './theme';

/**
 * Dibujo de las formas de los aspectos (casillas y nodos) y de sus fondos. Todo se pinta una sola vez en una
 * textura: los `Graphics` de Phaser se vuelven a teselar en cada fotograma, y eso es lo que cansa a los móviles modestos.
 */

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

/** Contorno de una casilla de lado `size` centrada en (0, 0). */
function tilePoints(size: number): Pt[] {
  const h = size / 2;
  const c = size * 0.22;
  return [
    { x: -h + c, y: -h }, { x: h - c, y: -h }, { x: h, y: -h + c }, { x: h, y: h - c },
    { x: h - c, y: h }, { x: -h + c, y: h }, { x: -h, y: h - c }, { x: -h, y: -h + c },
  ];
}

export function fillTile(g: G, style: SkinStyle, size: number, radius: number): void {
  const h = size / 2;
  if (style.tile === 'chamfer') g.fillPoints(tilePoints(size), true);
  else if (style.tile === 'circle') g.fillCircle(0, 0, h);
  else g.fillRoundedRect(-h, -h, size, size, style.tile === 'square' ? 3 : style.tile === 'pill' ? size * 0.36 : radius);
}

export function strokeTile(g: G, style: SkinStyle, size: number, radius: number, inset = 0): void {
  const s = size - inset * 2;
  const h = s / 2;
  if (style.tile === 'chamfer') g.strokePoints(tilePoints(s), true);
  else if (style.tile === 'circle') g.strokeCircle(0, 0, h);
  else g.strokeRoundedRect(-h, -h, s, s, style.tile === 'square' ? 3 : style.tile === 'pill' ? s * 0.36 : radius * (s / size));
}

/** Nodo del centro: círculo, rombo, cuadrado o sol (disco con ocho rayos). */
export function fillNode(g: G, style: SkinStyle, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  switch (style.node) {
    case 'diamond':
      g.fillPoints([{ x: 0, y: -r * 1.25 }, { x: r * 1.25, y: 0 }, { x: 0, y: r * 1.25 }, { x: -r * 1.25, y: 0 }], true);
      break;
    case 'square':
      g.fillRect(-r, -r, r * 2, r * 2);
      break;
    case 'bubble': {
      // Burbuja: disco con un anillo claro y un reflejo arriba a la izquierda
      g.fillCircle(0, 0, r);
      g.lineStyle(Math.max(1.5, r * 0.18), 0xffffff, alpha * 0.55);
      g.strokeCircle(0, 0, r * 0.86);
      g.fillStyle(0xffffff, alpha * 0.8);
      g.fillCircle(-r * 0.33, -r * 0.33, Math.max(1.5, r * 0.22));
      break;
    }
    case 'sun': {
      g.fillCircle(0, 0, r);
      g.lineStyle(Math.max(2, r * 0.28), color, alpha);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
        g.lineTo(Math.cos(a) * r * 1.95, Math.sin(a) * r * 1.95);
        g.strokePath();
      }
      break;
    }
    default:
      g.fillCircle(0, 0, r);
  }
}

/** Cable encendido en un tramo (0,0) → (dx·reach, dy·reach), según el estilo del aspecto. */
export function strokeLitLeg(g: G, style: SkinStyle, theme: GameTheme, leg: { dx: number; dy: number; reach: number }, w: number, glow: number): void {
  const line = (ox: number, oy: number, width: number, color: number, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(ox, oy);
    g.lineTo(leg.dx * leg.reach + ox, leg.dy * leg.reach + oy);
    g.strokePath();
  };
  if (style.wire === 'double') {
    // Dos pistas paralelas con el núcleo claro entre ellas, como una traza de circuito
    const off = w * 0.46;
    const px = -leg.dy * off;
    const py = leg.dx * off;
    line(px, py, w * 0.36, theme.primary);
    line(-px, -py, w * 0.36, theme.primary);
    line(0, 0, w * (0.16 + 0.12 * glow), theme.energyCore);
  } else if (style.wire === 'bits') {
    // Un hilo fino y, sobre él, una hilera de bits cuadrados
    line(0, 0, w * 0.45, theme.primary);
    const step = w * 1.5;
    const bit = w * 0.62;
    g.fillStyle(theme.energyCore, 1);
    for (let d = step * 0.5; d < leg.reach; d += step) {
      g.fillRect(leg.dx * d - bit / 2, leg.dy * d - bit / 2, bit, bit);
    }
  } else if (style.wire === 'wave') {
    // Onda que nace en el centro y llega al borde de la casilla en calma, para que empalme con la vecina
    const amp = w * 0.7;
    const steps = Math.max(12, Math.round(leg.reach / 4));
    // Una semionda cada ~1,5 grosores de cable: los tramos cortos llevan menos ondas y no se hacen un nudo
    const halfPeriods = Math.max(1, Math.round(leg.reach / (w * 1.55)));
    const wave = (width: number, color: number) => {
      g.lineStyle(width, color, 1);
      g.beginPath();
      for (let i = 0; i <= steps; i++) {
        const d = (i / steps) * leg.reach;
        const off = amp * Math.sin((halfPeriods * Math.PI * d) / leg.reach);
        const x = leg.dx * d - leg.dy * off;
        const y = leg.dy * d + leg.dx * off;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    };
    wave(w * 0.62, theme.primary);
    wave(w * (0.22 + 0.1 * glow), theme.energyCore);
  } else if (style.wire === 'plasma') {
    // Cuerpo ancho con un núcleo casi blanco muy grueso: se ve al rojo blanco
    line(0, 0, w * 1.15, theme.primary);
    line(0, 0, w * (0.55 + 0.2 * glow), theme.energyCore);
  } else {
    line(0, 0, w, theme.primary);
    line(0, 0, w * (0.36 + 0.2 * glow), theme.energyCore);
  }
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

export interface BackdropResult {
  objects: Phaser.GameObjects.GameObject[];
  /** Animaciones suaves del fondo (no se crean con las animaciones desactivadas). */
  tweens: Phaser.Tweens.Tween[];
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: G) => void): boolean {
  if (scene.textures.exists(key)) return true;
  const texture = scene.textures.addDynamicTexture(key, w, h);
  if (!texture) return false;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(g);
  texture.draw(g, 0, 0);
  g.destroy();
  return true;
}

/** Cuadrícula en perspectiva magenta con líneas de barrido finas (Cyberpunk). */
function gridBackdrop(scene: Phaser.Scene, theme: GameTheme, w: number, h: number, alpha: number, animate: boolean): BackdropResult {
  const key = `backdrop|grid|${theme.name}|${w}x${h}`;
  const horizon = h * 0.6;
  makeTexture(scene, key, w, h, (g) => {
    // Resplandor del horizonte
    for (let i = 0; i < 14; i++) {
      g.fillStyle(theme.accent, 0.018);
      g.fillRect(0, horizon - i * 14, w, 14);
    }
    // Líneas de escaneo muy tenues
    g.fillStyle(theme.primary, 0.05);
    for (let y = 0; y < h; y += 7) g.fillRect(0, y, w, 1);
    // Suelo en perspectiva: radiales desde el punto de fuga y horizontales cada vez más separadas
    g.lineStyle(2, theme.accent, 0.5);
    for (let i = -10; i <= 10; i++) {
      g.beginPath();
      g.moveTo(w / 2 + i * 12, horizon);
      g.lineTo(w / 2 + i * w * 0.22, h);
      g.strokePath();
    }
    for (let i = 1; i < 14; i++) {
      const y = horizon + (h - horizon) * Math.pow(i / 14, 2);
      g.lineStyle(2, theme.accent, 0.18 + 0.4 * (i / 14));
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.strokePath();
    }
    g.lineStyle(3, theme.primary, 0.9);
    g.beginPath();
    g.moveTo(0, horizon);
    g.lineTo(w, horizon);
    g.strokePath();
  });
  const image = scene.add.image(0, 0, key).setOrigin(0).setDepth(-100).setAlpha(alpha);
  const objects: Phaser.GameObjects.GameObject[] = [image];
  const tweens: Phaser.Tweens.Tween[] = [];
  if (animate) {
    // Una franja de luz que barre la pantalla despacio
    const band = scene.add.rectangle(0, -40, w, 36, theme.primary, 0.07).setOrigin(0).setDepth(-99);
    objects.push(band);
    tweens.push(scene.tweens.add({ targets: band, y: h, duration: 7000, repeat: -1, ease: 'Linear' }));
  }
  return { objects, tweens };
}

/** Lluvia de código verde que cae despacio (Matrix). */
function rainBackdrop(scene: Phaser.Scene, theme: GameTheme, w: number, h: number, alpha: number, animate: boolean): BackdropResult {
  const key = `backdrop|rain|${theme.name}|${w}x${h}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.addDynamicTexture(key, w, h);
    if (texture) {
      const glyphs = '0123456789ABCDEF<>=+*:.';
      let seed = 12345;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const colW = 30;
      const rowH = 28;
      const rows = Math.floor(h / rowH);
      const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
      for (let col = 0; col < Math.floor(w / colW); col++) {
        const len = 5 + Math.floor(rnd() * 12);
        const start = Math.floor(rnd() * rows);
        for (let i = 0; i < len; i++) {
          const head = i === len - 1;
          const row = start + i;
          if (row >= rows) break; // la textura se repite en vertical: las columnas no cruzan el borde
          const text = scene.make.text({
            x: col * colW + colW / 2,
            y: row * rowH + rowH / 2,
            text: glyphs[Math.floor(rnd() * glyphs.length)],
            style: { fontFamily: 'monospace', fontSize: '22px', color: css(head ? theme.energyCore : theme.primary) },
            add: false,
          });
          text.setOrigin(0.5);
          text.setAlpha(head ? 1 : 0.12 + 0.55 * (i / len));
          texture.draw(text, text.x, text.y);
          text.destroy();
        }
      }
    }
  }
  // Dos copias apiladas dentro de un contenedor que baja y vuelve a empezar sin saltos
  const first = scene.add.image(0, 0, key).setOrigin(0);
  const second = scene.add.image(0, -h, key).setOrigin(0);
  const container = scene.add.container(0, 0, [first, second]).setDepth(-100).setAlpha(alpha);
  const tweens: Phaser.Tweens.Tween[] = [];
  if (animate) tweens.push(scene.tweens.add({ targets: container, y: h, duration: 26000, repeat: -1, ease: 'Linear' }));
  return { objects: [container], tweens };
}

/** Órbitas concéntricas y un abanico de rayos que gira muy despacio (Solar). */
function orbitBackdrop(scene: Phaser.Scene, theme: GameTheme, w: number, h: number, alpha: number, animate: boolean): BackdropResult {
  const cx = w / 2;
  const cy = h * 0.56;
  const key = `backdrop|orbit|${theme.name}|${w}x${h}`;
  const raysKey = `backdrop|rays|${theme.name}`;
  makeTexture(scene, key, w, h, (g) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle(theme.accent, 0.022);
      g.fillCircle(cx, cy, w * (0.2 + i * 0.05));
    }
    for (let i = 1; i <= 6; i++) {
      g.lineStyle(i % 2 ? 2 : 3, theme.primary, 0.12 + 0.05 * (i % 2));
      g.strokeCircle(cx, cy, w * 0.17 * i);
    }
  });
  makeTexture(scene, raysKey, 1024, 1024, (g) => {
    const wedges = 20;
    g.fillStyle(theme.primary, 0.035);
    for (let i = 0; i < wedges; i++) {
      const a0 = (i / wedges) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / wedges / 2;
      g.fillTriangle(512, 512, 512 + Math.cos(a0) * 760, 512 + Math.sin(a0) * 760, 512 + Math.cos(a1) * 760, 512 + Math.sin(a1) * 760);
    }
  });
  const rings = scene.add.image(0, 0, key).setOrigin(0).setDepth(-100).setAlpha(alpha);
  const rays = scene.add.image(cx, cy, raysKey).setDepth(-101).setAlpha(alpha).setScale((h * 1.15) / 1024);
  const tweens: Phaser.Tweens.Tween[] = [];
  if (animate) tweens.push(scene.tweens.add({ targets: rays, angle: 360, duration: 180000, repeat: -1, ease: 'Linear' }));
  return { objects: [rings, rays], tweens };
}

/** Bandas de olas y haces de luz; burbujas que suben despacio (Océano). */
function wavesBackdrop(scene: Phaser.Scene, theme: GameTheme, w: number, h: number, alpha: number, animate: boolean): BackdropResult {
  const key = `backdrop|waves|${theme.name}|${w}x${h}`;
  makeTexture(scene, key, w, h, (g) => {
    // Haces de luz que bajan desde la superficie
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + i * 0.22);
      g.fillStyle(theme.energyCore, 0.035);
      g.fillTriangle(x, 0, x + 150, 0, x - 120 + i * 40, h * 0.7);
    }
    // Bandas de olas apiladas desde abajo
    for (let band = 0; band < 5; band++) {
      const base = h * (0.52 + band * 0.1);
      const amp = 16 + band * 5;
      const points: Array<{ x: number; y: number }> = [];
      for (let x = 0; x <= w; x += 12) points.push({ x, y: base + amp * Math.sin((x / w) * Math.PI * (3 + band) + band * 1.3) });
      points.push({ x: w, y: h }, { x: 0, y: h });
      g.fillStyle(theme.primary, 0.05 + band * 0.012);
      g.fillPoints(points, true);
      g.lineStyle(2, theme.energyCore, 0.12);
      g.strokePoints(points.slice(0, -2), false);
    }
  });
  const base = scene.add.image(0, 0, key).setOrigin(0).setDepth(-100).setAlpha(alpha);
  const objects: Phaser.GameObjects.GameObject[] = [base];
  const tweens: Phaser.Tweens.Tween[] = [];

  const bubbleKey = `backdrop|bubble|${theme.name}`;
  makeTexture(scene, bubbleKey, 48, 48, (g) => {
    g.lineStyle(3, theme.energyCore, 0.9);
    g.strokeCircle(24, 24, 20);
    g.fillStyle(theme.energyCore, 0.18);
    g.fillCircle(24, 24, 20);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(16, 16, 4);
  });
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 14; i++) {
    const scale = 0.25 + rnd() * 0.6;
    const bubble = scene.add.image(rnd() * w, h + 40, bubbleKey).setDepth(-99).setAlpha(0.18 + rnd() * 0.3).setScale(scale);
    objects.push(bubble);
    if (animate) {
      tweens.push(scene.tweens.add({ targets: bubble, y: -40, duration: 11000 + rnd() * 14000, delay: rnd() * 12000, repeat: -1, ease: 'Linear' }));
    } else {
      bubble.y = rnd() * h; // sin movimiento: burbujas quietas repartidas por la pantalla
    }
  }
  return { objects, tweens };
}

export function buildBackdrop(scene: Phaser.Scene, style: SkinStyle, theme: GameTheme, w: number, h: number, opts: { alpha: number; animate: boolean }): BackdropResult | null {
  switch (style.backdrop) {
    case 'grid': return gridBackdrop(scene, theme, w, h, opts.alpha, opts.animate);
    case 'rain': return rainBackdrop(scene, theme, w, h, opts.alpha, opts.animate);
    case 'orbit': return orbitBackdrop(scene, theme, w, h, opts.alpha, opts.animate);
    case 'waves': return wavesBackdrop(scene, theme, w, h, opts.alpha, opts.animate);
    default: return null;
  }
}
