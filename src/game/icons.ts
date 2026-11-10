import type Phaser from 'phaser';

/**
 * Iconos dibujados con Graphics: se ven idénticos en cualquier teléfono (los emojis cambian según
 * la marca del dispositivo). Todos son geométricos y se dibujan centrados en (cx, cy) dentro de un
 * cuadrado de lado `size`.
 */

export type IconKind =
  | 'stats'
  | 'calendar'
  | 'moon'
  | 'sun'
  | 'reset'
  | 'undo'
  | 'bulb'
  | 'spark'
  | 'home'
  | 'menu'
  | 'back'
  | 'circuits'
  | 'lights'
  | 'flow';

type G = Phaser.GameObjects.Graphics;

/** Flecha circular de 270° con punta; `mirror = -1` la refleja (sentido antihorario). */
export function drawArrowCircle(
  g: G,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  lineWidth: number,
  mirror: 1 | -1 = 1
): void {
  const start = -Math.PI * 0.55;
  const end = start + Math.PI * 1.5;
  const segments = 28;

  g.lineStyle(lineWidth, color, 1);
  g.beginPath();
  for (let i = 0; i <= segments; i++) {
    const theta = start + ((end - start) * i) / segments;
    const x = cx + mirror * radius * Math.cos(theta);
    const y = cy + radius * Math.sin(theta);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();

  const head = lineWidth * 2.2;
  const tx = mirror * -Math.sin(end); // tangente (hacia donde avanza el arco)
  const ty = Math.cos(end);
  const nx = mirror * Math.cos(end); // radial
  const ny = Math.sin(end);
  const ex = cx + radius * nx;
  const ey = cy + radius * ny;
  g.fillStyle(color, 1);
  g.fillTriangle(
    ex + tx * head * 1.1,
    ey + ty * head * 1.1,
    ex + nx * head * 0.85,
    ey + ny * head * 0.85,
    ex - nx * head * 0.85,
    ey - ny * head * 0.85
  );
}

/**
 * Dibuja un icono. `cut` es el color de fondo de la superficie donde se dibuja
 * (solo la luna lo necesita, para recortar la media luna).
 */
export function drawIcon(
  g: G,
  kind: IconKind,
  cx: number,
  cy: number,
  size: number,
  color: number,
  cut: number = 0x000000
): void {
  const s = size;
  const lw = Math.max(3, s * 0.11);
  g.lineStyle(lw, color, 1);
  g.fillStyle(color, 1);

  switch (kind) {
    case 'spark': {
      // Estrella de cuatro puntas
      const outer = s * 0.5;
      const inner = s * 0.14;
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
      break;
    }

    case 'stats': {
      // Tres barras de distinta altura
      const w = s * 0.24;
      const gap = s * 0.1;
      const heights = [s * 0.5, s * 0.9, s * 0.68];
      const left = cx - (3 * w + 2 * gap) / 2;
      const base = cy + s * 0.45;
      heights.forEach((h, i) => g.fillRoundedRect(left + i * (w + gap), base - h, w, h, w * 0.3));
      break;
    }

    case 'calendar': {
      const w = s * 0.92;
      const h = s * 0.84;
      const x = cx - w / 2;
      const y = cy - h / 2 + s * 0.06;
      g.strokeRoundedRect(x, y, w, h, s * 0.14);
      g.fillRect(x + lw / 2, y + lw / 2, w - lw, s * 0.2);
      g.fillRoundedRect(cx - s * 0.2, y - s * 0.12, lw, s * 0.24, lw / 2);
      g.fillRoundedRect(cx + s * 0.2 - lw, y - s * 0.12, lw, s * 0.24, lw / 2);
      g.fillRoundedRect(cx - s * 0.14, y + s * 0.42, s * 0.28, s * 0.22, s * 0.05);
      break;
    }

    case 'moon': {
      const r = s * 0.42;
      g.fillCircle(cx - s * 0.04, cy, r);
      g.fillStyle(cut, 1);
      g.fillCircle(cx + s * 0.2, cy - s * 0.14, r * 0.82);
      break;
    }

    case 'sun': {
      g.fillCircle(cx, cy, s * 0.2);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34);
        g.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5);
        g.strokePath();
      }
      break;
    }

    case 'reset': {
      drawArrowCircle(g, cx, cy, s * 0.32, color, lw, 1);
      break;
    }

    case 'undo': {
      // Arco sobre la parte superior, de derecha a izquierda, con punta hacia abajo
      const r = s * 0.34;
      const oy = cy + s * 0.08;
      const segments = 20;
      g.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = (Math.PI * i) / segments;
        const x = cx + Math.cos(theta) * r;
        const y = oy - Math.sin(theta) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      const ex = cx - r;
      const head = lw * 2.2;
      g.fillTriangle(ex, oy + head * 1.15, ex - head * 0.9, oy - head * 0.1, ex + head * 0.9, oy - head * 0.1);
      break;
    }

    case 'bulb': {
      const r = s * 0.28;
      const by = cy - s * 0.12;
      g.strokeCircle(cx, by, r);
      g.fillRoundedRect(cx - s * 0.15, cy + s * 0.2, s * 0.3, lw, lw / 2);
      g.fillRoundedRect(cx - s * 0.1, cy + s * 0.34, s * 0.2, lw, lw / 2);
      g.beginPath();
      g.moveTo(cx - s * 0.1, by + r * 0.95);
      g.lineTo(cx - s * 0.1, cy + s * 0.2);
      g.moveTo(cx + s * 0.1, by + r * 0.95);
      g.lineTo(cx + s * 0.1, cy + s * 0.2);
      g.strokePath();
      break;
    }

    case 'back': {
      // Flecha hacia la izquierda
      g.beginPath();
      g.moveTo(cx + s * 0.4, cy);
      g.lineTo(cx - s * 0.4, cy);
      g.strokePath();
      g.beginPath();
      g.moveTo(cx - s * 0.04, cy - s * 0.36);
      g.lineTo(cx - s * 0.4, cy);
      g.lineTo(cx - s * 0.04, cy + s * 0.36);
      g.strokePath();
      break;
    }

    case 'menu': {
      // Tres barras
      for (const dy of [-0.26, 0, 0.26]) {
        g.beginPath();
        g.moveTo(cx - s * 0.38, cy + dy * s);
        g.lineTo(cx + s * 0.38, cy + dy * s);
        g.strokePath();
      }
      break;
    }

    case 'circuits': {
      // Cable con codo, una fuente y un nodo
      g.beginPath();
      g.moveTo(cx - s * 0.42, cy + s * 0.24);
      g.lineTo(cx - s * 0.04, cy + s * 0.24);
      g.lineTo(cx - s * 0.04, cy - s * 0.24);
      g.lineTo(cx + s * 0.4, cy - s * 0.24);
      g.strokePath();
      g.fillCircle(cx - s * 0.42, cy + s * 0.24, s * 0.11);
      g.fillCircle(cx + s * 0.4, cy - s * 0.24, s * 0.11);
      break;
    }

    case 'lights': {
      // Lámpara encendida: disco con rayos
      g.fillCircle(cx, cy, s * 0.2);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * s * 0.33, cy + Math.sin(a) * s * 0.33);
        g.lineTo(cx + Math.cos(a) * s * 0.48, cy + Math.sin(a) * s * 0.48);
        g.strokePath();
      }
      break;
    }

    case 'flow': {
      // Un hilo ondulado que une dos puntos
      g.beginPath();
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = cx - s * 0.42 + u * s * 0.84;
        const y = cy + Math.sin(u * Math.PI * 2) * s * 0.22;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      g.fillCircle(cx - s * 0.42, cy, s * 0.11);
      g.fillCircle(cx + s * 0.42, cy, s * 0.11);
      break;
    }

    case 'home': {
      const w = s * 0.8;
      g.fillTriangle(cx, cy - s * 0.46, cx - s * 0.5, cy - s * 0.02, cx + s * 0.5, cy - s * 0.02);
      g.fillRect(cx - w / 2 + s * 0.06, cy - s * 0.04, w - s * 0.12, s * 0.46);
      g.fillStyle(cut, 1);
      g.fillRect(cx - s * 0.09, cy + s * 0.16, s * 0.18, s * 0.26);
      break;
    }
  }
}
