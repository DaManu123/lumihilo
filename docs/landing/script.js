/**
 * Lumihilo · página de presentación (ES y EN).
 * Front-end puro: tablero de demostración, botón de la beta, copiar correo. No toca el juego.
 */

/**
 * Enlace del formulario privado para pedir acceso a la beta (Google Forms, respuestas solo visibles para el
 * propietario). Mientras esté vacío, el botón usa el correo de contacto (mailto) como respaldo.
 * Pega aquí la URL pública de rellenar el formulario (termina en /viewform), NUNCA la de la hoja de respuestas.
 */
const BETA_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdui9rSLMR0abGc6i2YgCMF5x6RH1k4nl9bAdW5VUzfBc_MFA/viewform';

const LANG = document.documentElement.lang === 'en' ? 'en' : 'es';

const TEXT = {
  es: {
    cell: (r, c) => `Pieza de la fila ${r}, columna ${c}. Pulsa para girarla`,
    start: 'Toca una pieza para girarla y conecta todo con la fuente rosa.',
    progress: (n, total) => `<strong>${n} de ${total}</strong> piezas conectadas.`,
    solved: '<strong>Todo conectado.</strong> Así se siente cada partida. Prueba otro tablero.',
    copied: 'Copiado',
    copy: 'Copiar',
  },
  en: {
    cell: (r, c) => `Piece at row ${r}, column ${c}. Press to rotate it`,
    start: 'Tap a piece to rotate it and connect everything to the pink source.',
    progress: (n, total) => `<strong>${n} of ${total}</strong> pieces connected.`,
    solved: '<strong>All connected.</strong> That is what every game feels like. Try another board.',
    copied: 'Copied',
    copy: 'Copy',
  },
}[LANG];

/* Aspectos del juego: mismos colores que el tema oscuro de cada uno (src/game/theme.ts) */
const SKINS = {
  filamento: null, // usa la paleta de la página (Noche o Papel)
  cyberpunk: { bg: '#0a0612', glass: '#160c26', line: '#35224f', lit: '#00e5ff', core: '#e0fcff', src: '#ff2e93', off: '#6b5a99' },
  matrix: { bg: '#020b05', glass: '#08170d', line: '#1c3a27', lit: '#3dff7a', core: '#e6ffee', src: '#ff4d4d', off: '#3f7d57' },
  oceano: { bg: '#04131c', glass: '#0a2433', line: '#16384c', lit: '#35e0c4', core: '#e8fffa', src: '#ff7a59', off: '#3f7f9a' },
  solar: { bg: '#1c0b0b', glass: '#2d1414', line: '#4a2323', lit: '#ffe45c', core: '#ffffff', src: '#ff4d2e', off: '#8c5a4c' },
  aurora: { bg: '#060a1c', glass: '#0f1633', line: '#232d5c', lit: '#8affc1', core: '#f2fff9', src: '#c77dff', off: '#4f5a96' },
};

/* ---------- Tablero de demostración ---------- */
const N = 4;
const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const DIRS = [
  { bit: UP, dr: -1, dc: 0, opp: DOWN, d: 'M50 50V0' },
  { bit: RIGHT, dr: 0, dc: 1, opp: LEFT, d: 'M50 50H100' },
  { bit: DOWN, dr: 1, dc: 0, opp: UP, d: 'M50 50V100' },
  { bit: LEFT, dr: 0, dc: -1, opp: RIGHT, d: 'M50 50H0' },
];
const rotate = (mask, k) => {
  let m = mask;
  for (let i = 0; i < k % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};
const popcount = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

/** Árbol de expansión al azar (grado máximo 3): siempre tiene solución. */
function makeLevel() {
  for (;;) {
    const mask = Array.from({ length: N * N }, () => 0);
    const inTree = new Set();
    const source = Math.floor(Math.random() * N * N);
    inTree.add(source);
    const frontier = [];
    const addFrontier = (i) => {
      const r = Math.floor(i / N), c = i % N;
      DIRS.forEach((d, di) => {
        const nr = r + d.dr, nc = c + d.dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) frontier.push([i, nr * N + nc, di]);
      });
    };
    addFrontier(source);
    while (inTree.size < N * N && frontier.length) {
      const [from, to, di] = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
      if (inTree.has(to) || popcount(mask[from]) >= 3) continue;
      mask[from] |= DIRS[di].bit;
      mask[to] |= DIRS[di].opp;
      inTree.add(to);
      addFrontier(to);
    }
    if (inTree.size === N * N && mask.every((m) => popcount(m) <= 3)) {
      const turns = mask.map(() => Math.floor(Math.random() * 4));
      const level = { mask, source, turns };
      if (litCount(level).size < N * N) return level;
    }
  }
}

/** Piezas conectadas a la fuente según su giro actual, con su distancia. */
function litCount(level) {
  const cur = level.mask.map((m, i) => rotate(m, level.turns[i]));
  const dist = new Map([[level.source, 0]]);
  const queue = [level.source];
  while (queue.length) {
    const i = queue.shift();
    const r = Math.floor(i / N), c = i % N;
    for (const d of DIRS) {
      if (!(cur[i] & d.bit)) continue;
      const nr = r + d.dr, nc = c + d.dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const j = nr * N + nc;
      if (dist.has(j) || !(cur[j] & d.opp)) continue;
      dist.set(j, dist.get(i) + 1);
      queue.push(j);
    }
  }
  return dist;
}

function pieceSvg(mask, isSource) {
  const paths = DIRS.filter((d) => mask & d.bit).map((d) => d.d).join('');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="piece">
    <path class="wire w-off" d="${paths}"/>
    <path class="wire w-halo" d="${paths}"/>
    <path class="wire w-on" d="${paths}"/>
    <path class="wire w-core" d="${paths}"/>
    ${isSource
      ? '<circle class="src-ring" cx="50" cy="50" r="17"/><circle class="src-dot" cx="50" cy="50" r="9"/>'
      : '<circle class="node-off" cx="50" cy="50" r="6"/><circle class="node-on" cx="50" cy="50" r="6"/>'}
  </g></svg>`;
}

function setupBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  const status = document.getElementById('boardStatus');
  const frame = document.getElementById('boardFrame');
  let level = null;
  let cells = [];

  const paint = (animate) => {
    const dist = litCount(level);
    const solved = dist.size === N * N;
    cells.forEach((cell, i) => {
      cell.classList.toggle('lit', dist.has(i));
      cell.style.setProperty('--d', dist.get(i) ?? 0);
      cell.querySelector('.piece').style.transform = `rotate(${level.turns[i] * 90}deg)`;
    });
    if (solved) {
      board.classList.remove('solved');
      void board.offsetWidth; // reinicia la animación
      board.classList.add('solved');
      status.innerHTML = TEXT.solved;
    } else {
      board.classList.remove('solved');
      status.innerHTML = animate && dist.size > 1 ? TEXT.progress(dist.size, N * N) : TEXT.start;
    }
  };

  const build = () => {
    level = makeLevel();
    board.innerHTML = '';
    cells = level.mask.map((m, i) => {
      const li = document.createElement('li');
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.setAttribute('aria-label', TEXT.cell(Math.floor(i / N) + 1, (i % N) + 1));
      cell.innerHTML = pieceSvg(m, i === level.source);
      cell.addEventListener('click', () => {
        level.turns[i] += 1;
        paint(true);
      });
      li.appendChild(cell);
      board.appendChild(li);
      return cell;
    });
    paint(false);
  };

  document.getElementById('newBoard')?.addEventListener('click', build);

  // Selector de aspecto: cambia solo los colores del tablero
  const apply = (name) => {
    const skin = SKINS[name];
    const set = (k, v) => (v == null ? frame.style.removeProperty(k) : frame.style.setProperty(k, v));
    frame.classList.toggle('is-skinned', !!skin);
    set('--board-bg', skin?.bg);
    set('--cell-bg', skin?.glass);
    set('--cell-line', skin?.line);
    set('--lit', skin?.lit);
    set('--core', skin?.core);
    set('--src', skin?.src);
    set('--off', skin?.off);
  };
  document.querySelectorAll('input[name="skin"]').forEach((input) => {
    input.addEventListener('change', () => apply(input.value));
  });

  build();
}

/* ---------- Resto de la página ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Enlaces antiguos a la ventana de privacidad
  if (window.location.hash === '#privacy' || window.location.hash === '#politica') {
    window.location.replace(LANG === 'en' ? 'privacy.html' : 'privacidad.html');
    return;
  }

  const year = document.getElementById('currentYear');
  if (year) year.textContent = new Date().getFullYear();

  const join = document.getElementById('betaJoinBtn');
  if (join && /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//.test(BETA_FORM_URL)) {
    join.href = BETA_FORM_URL;
    join.target = '_blank';
    join.rel = 'noopener noreferrer';
  }

  const copyBtn = document.getElementById('copyEmailBtn');
  const mail = document.getElementById('supportEmailLink');
  if (copyBtn && mail) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(mail.textContent.trim());
        copyBtn.textContent = TEXT.copied;
        setTimeout(() => (copyBtn.textContent = TEXT.copy), 2200);
      } catch (err) {
        console.warn('No se pudo copiar el correo', err);
      }
    });
  }

  setupBoard();
});
