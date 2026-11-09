import { FlowCell, FlowLevel, FlowState, endpointPair, pairComplete, pathOwner, sameCell } from '../core/flow';

/** Lo que hace falta saber para dibujar una casilla de Hilos (sin Phaser, para poder probarlo en Node). */

export interface FlowLeg {
  dx: number;
  dy: number;
  /** Hasta dónde llega el hilo desde el centro. */
  reach: number;
}

export interface FlowCellLook {
  /** Pareja dueña del hilo en esta casilla (-1 = vacía); los puntos son siempre de su pareja. */
  owner: number;
  /** La casilla es un punto de una pareja. */
  endpoint: boolean;
  /** La pareja de esta casilla está unida. */
  complete: boolean;
  legs: FlowLeg[];
  hintRing: boolean;
  /** Brillo extra, de 0 a 1. */
  glow: number;
}

/** El aspecto de cada casilla del tablero para un estado de los hilos. `reach` es lo que se asoma el hilo hacia una casilla vecina. */
export function flowLooks(level: FlowLevel, state: FlowState, reach: number): FlowCellLook[][] {
  const size = level.params.size;
  const looks: FlowCellLook[][] = [];
  for (let row = 0; row < size; row++) {
    const line: FlowCellLook[] = [];
    for (let col = 0; col < size; col++) {
      const cell: FlowCell = { row, col };
      const endpointOf = endpointPair(level, cell);
      const pathOf = pathOwner(state, cell);
      const owner = endpointOf >= 0 ? endpointOf : pathOf;
      const legs: FlowLeg[] = [];
      if (pathOf >= 0) {
        const path = state.paths[pathOf];
        const index = path.findIndex((c) => sameCell(c, cell));
        for (const neighbor of [path[index - 1], path[index + 1]]) {
          if (neighbor) legs.push({ dx: neighbor.col - col, dy: neighbor.row - row, reach });
        }
      }
      line.push({
        owner,
        endpoint: endpointOf >= 0,
        complete: owner >= 0 && pairComplete(state, level, owner),
        legs,
        hintRing: false,
        glow: 0,
      });
    }
    looks.push(line);
  }
  return looks;
}
