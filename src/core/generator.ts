import {
  Direction,
  DIRECTION_MASKS,
  OPPOSITE_DIRECTIONS,
  DIRECTION_DELTAS,
  BoardState,
  CellState,
  LevelParams,
  GeneratedLevel,
} from './types';
import { mulberry32 } from './rng';
import { checkVictory } from './grid';

/**
 * Genera un nivel procedural garantizado resoluble mediante el algoritmo de árbol de expansión.
 * Es 100% determinista: misma semilla + mismos parámetros = idéntico nivel.
 */
export function generateLevel(params: LevelParams, seed: number): GeneratedLevel {
  const rng = mulberry32(seed);
  const { width, height, extraLoops, branchBias, decoys = 0 } = params;

  // 1. Estructura de conexiones en el grid [r][c] -> Set de direcciones
  const connections: Set<Direction>[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => new Set<Direction>())
  );

  // 2. Generación del árbol de expansión (Growing Tree Algorithm)
  const inTree: Array<{ r: number; c: number }> = [];
  const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  const startR = 0;
  const startC = 0;
  visited[startR][startC] = true;
  inTree.push({ r: startR, c: startC });

  const directionsList = [
    Direction.NORTH,
    Direction.EAST,
    Direction.SOUTH,
    Direction.WEST,
  ];

  while (inTree.length > 0) {
    // Selección del nodo según branchBias:
    // Con branchBias alto -> elige nodo aleatorio (más ramificaciones, estilo Prim).
    // Con branchBias bajo -> elige el más reciente (caminos largos y sinuosos, estilo DFS).
    const index =
      rng() < branchBias
        ? Math.floor(rng() * inTree.length)
        : inTree.length - 1;

    const current = inTree[index];

    // Buscar vecinos no visitados
    const unvisitedNeighbors: Array<{ r: number; c: number; dir: Direction }> = [];

    for (const dir of directionsList) {
      const delta = DIRECTION_DELTAS[dir];
      const nr = current.r + delta.dr;
      const nc = current.c + delta.dc;

      if (nr >= 0 && nr < height && nc >= 0 && nc < width && !visited[nr][nc]) {
        unvisitedNeighbors.push({ r: nr, c: nc, dir });
      }
    }

    if (unvisitedNeighbors.length === 0) {
      inTree.splice(index, 1);
    } else {
      // Elegir un vecino no visitado al azar
      const pick = unvisitedNeighbors[Math.floor(rng() * unvisitedNeighbors.length)];
      visited[pick.r][pick.c] = true;

      // Conectar bidireccionalmente
      connections[current.r][current.c].add(pick.dir);
      connections[pick.r][pick.c].add(OPPOSITE_DIRECTIONS[pick.dir]);

      inTree.push({ r: pick.r, c: pick.c });
    }
  }

  // 3. Ciclos opcionales: agregar aristas extra entre celdas vecinas no conectadas
  let actualCycles = 0;
  if (extraLoops > 0) {
    const candidateEdges: Array<{ r1: number; c1: number; r2: number; c2: number; dir: Direction }> = [];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        // Solo revisar hacia el Este y Sur para no duplicar pares
        for (const dir of [Direction.EAST, Direction.SOUTH]) {
          const delta = DIRECTION_DELTAS[dir];
          const nr = r + delta.dr;
          const nc = c + delta.dc;

          if (nr < height && nc < width) {
            if (!connections[r][c].has(dir)) {
              candidateEdges.push({ r1: r, c1: c, r2: nr, c2: nc, dir });
            }
          }
        }
      }
    }

    // Mezclar candidatos con el RNG determinista
    for (let i = candidateEdges.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidateEdges[i];
      candidateEdges[i] = candidateEdges[j];
      candidateEdges[j] = tmp;
    }

    const loopsToAdd = Math.min(extraLoops, candidateEdges.length);
    for (let i = 0; i < loopsToAdd; i++) {
      const edge = candidateEdges[i];
      connections[edge.r1][edge.c1].add(edge.dir);
      connections[edge.r2][edge.c2].add(OPPOSITE_DIRECTIONS[edge.dir]);
      actualCycles++;
    }
  }

  // 4. Construir baseMask de cada celda y contar bifurcaciones
  let branches = 0;
  const grid: CellState[][] = [];

  for (let r = 0; r < height; r++) {
    const rowCells: CellState[] = [];
    for (let c = 0; c < width; c++) {
      let mask = 0;
      for (const dir of connections[r][c]) {
        mask |= DIRECTION_MASKS[dir];
      }

      if (connections[r][c].size >= 3) {
        branches++;
      }

      rowCells.push({
        row: r,
        col: c,
        baseMask: mask,
        rotation: 0,
        isSource: r === 0 && c === 0,
      });
    }
    grid.push(rowCells);
  }

  const board: BoardState = {
    rows: height,
    cols: width,
    grid,
    source: { row: 0, col: 0 },
  };

  // 5. Desordenar (Scramble) de forma garantizada no resuelta
  const initialRotations: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  let isSolved = true;
  let attempts = 0;

  while ((isSolved || countMisalignedPieces(board) < Math.floor(width * height * 0.6)) && attempts < 20) {
    attempts++;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        // La cruz tiene 1 estado (simetría 4). La recta tiene 2 estados. Los demás tienen 4.
        const rot = Math.floor(rng() * 4);
        grid[r][c].rotation = rot;
        initialRotations[r][c] = rot;
      }
    }
    isSolved = checkVictory(board);
  }

  // Si por improbable casualidad tras 20 intentos sigue resuelto, forzar giro de una pieza
  if (isSolved) {
    grid[0][0].rotation = 1;
    initialRotations[0][0] = 1;
  }

  // 6. Cálculo de toques mínimos en sentido horario (minTaps)
  let minTaps = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const mask = grid[r][c].baseMask;
      const rot = grid[r][c].rotation;
      minTaps += calculateCellMinTaps(mask, rot);
    }
  }

  // 7. Fórmula de dificultad: d = celdas * 1.0 + ramas * 1.5 + ciclos * 3.0 + señuelos * 0.5
  const cells = width * height;
  const difficulty = cells * 1.0 + branches * 1.5 + actualCycles * 3.0 + decoys * 0.5;

  const solutionRotations = Array.from({ length: height }, () => Array(width).fill(0));

  return {
    seed,
    params,
    board,
    solutionRotations,
    initialRotations,
    minTaps,
    difficulty,
    branches,
    cycles: actualCycles,
  };
}

/**
 * Calcula los toques mínimos en sentido horario necesarios para resolver una pieza dada su rotación.
 */
export function calculateCellMinTaps(baseMask: number, currentRotation: number): number {
  const rot = ((currentRotation % 4) + 4) % 4;

  // Cruz (15): 4 puertos activos -> simetría total, 0 toques requeridos
  if (baseMask === 15) {
    return 0;
  }

  // Línea recta (5 o 10): simetría de 180° (período 2)
  if (baseMask === 5 || baseMask === 10) {
    return rot % 2 === 0 ? 0 : 1;
  }

  // Esquina, T, Extremo: simetría de 360° (período 4)
  // En rotación horaria (CW), de rot a 0 se requieren: (4 - rot) % 4 toques
  return (4 - rot) % 4;
}

/**
 * Cuenta cuántas piezas en el tablero están desalineadas respecto a su solución.
 */
function countMisalignedPieces(board: BoardState): number {
  let count = 0;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.grid[r][c];
      if (calculateCellMinTaps(cell.baseMask, cell.rotation) > 0) {
        count++;
      }
    }
  }
  return count;
}
