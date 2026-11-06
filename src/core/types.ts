/**
 * Direcciones cardinales para los puertos de las piezas del circuito.
 * 0: Norte (Arriba)
 * 1: Este (Derecha)
 * 2: Sur (Abajo)
 * 3: Oeste (Izquierda)
 */
export enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}

export const DIRECTION_MASKS = {
  [Direction.NORTH]: 1 << 0, // 1  (0001)
  [Direction.EAST]: 1 << 1,  // 2  (0010)
  [Direction.SOUTH]: 1 << 2, // 4  (0100)
  [Direction.WEST]: 1 << 3,  // 8  (1000)
} as const;

export const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  [Direction.NORTH]: Direction.SOUTH,
  [Direction.EAST]: Direction.WEST,
  [Direction.SOUTH]: Direction.NORTH,
  [Direction.WEST]: Direction.EAST,
};

export const DIRECTION_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  [Direction.NORTH]: { dr: -1, dc: 0 },
  [Direction.EAST]: { dr: 0, dc: 1 },
  [Direction.SOUTH]: { dr: 1, dc: 0 },
  [Direction.WEST]: { dr: 0, dc: -1 },
};

/**
 * Tipos de pieza según la cantidad y disposición de puertos conectados.
 */
export enum PieceType {
  END = 'END',       // 1 terminal (1 puerto)
  LINE = 'LINE',     // Línea recta (2 puertos opuestos)
  CORNER = 'CORNER', // Esquina / Codo (2 puertos adyacentes a 90°)
  TEE = 'TEE',       // T (3 puertos)
  CROSS = 'CROSS',   // Cruz (4 puertos)
}

export interface CellState {
  row: number;
  col: number;
  baseMask: number;     // Máscara original con rotación = 0
  rotation: number;     // 0: 0°, 1: 90°, 2: 180°, 3: 270°
  isSource: boolean;    // Si es la fuente generadora de energía
}

export interface BoardState {
  rows: number;
  cols: number;
  grid: CellState[][];
  source: { row: number; col: number };
}

export interface LevelParams {
  width: number;        // Columnas
  height: number;       // Filas
  extraLoops: number;   // Aristas extra sobre el árbol -> ciclos
  branchBias: number;   // 0..1, tendencia a ramificar vs camino serpenteante
  decoys?: number;      // Piezas decorativas / ruido (por defecto 0)
}

export interface GeneratedLevel {
  seed: number;
  params: LevelParams;
  board: BoardState;
  solutionRotations: number[][]; // Matriz de rotaciones solución (todas 0 con respecto a baseMask)
  initialRotations: number[][];  // Matriz de rotaciones desordenadas iniciales
  minTaps: number;               // Mínimo de toques (horarios o antihorarios) para resolver
  difficulty: number;            // Puntuación de dificultad d(nivel)
  branches: number;              // Cantidad de nodos ramificados (T y Cruz)
  cycles: number;                // Cantidad de ciclos en el circuito
}
