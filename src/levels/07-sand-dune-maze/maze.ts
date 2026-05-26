// Procedural maze generator for L7.
//
// Builds a grid of `MAP_COLS × MAP_ROWS` tiles. Uses a depth-first backtracker
// to carve a perfect maze, then knocks a handful of random interior walls down
// to introduce loops (kid-friendlier; reduces frustrating dead-ends). Picks
// the spawn at (1,1), the exit at the furthest BFS-reachable floor cell, then
// scatters artifacts on dead-ends and traps/quicksand on other floor cells.
//
// Walls are coalesced into horizontal rectangle runs to keep the physics body
// count low (≤ ~30 instead of the ~150+ individual wall tiles).

import { DUNE_MAZE_CONFIG as CFG } from './config';

export type Tile = '#' | '.' | 'S' | 'E' | 'Q' | 'T' | 'A';

export interface CellPos {
  col: number;
  row: number;
}

export interface WallRect {
  // World-space rectangle (top-left + width/height in px).
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedMap {
  grid: Tile[][];
  walls: WallRect[];
  spawn: CellPos;
  exit: CellPos;
  artifacts: CellPos[];
  traps: CellPos[];
  quicksand: CellPos[];
  worldWidthPx: number;
  worldHeightPx: number;
}

export function generateMap(): ParsedMap {
  const cols = CFG.mapCols;
  const rows = CFG.mapRows;
  const grid: Tile[][] = Array.from({ length: rows }, () => Array(cols).fill('#' as Tile));

  // 1. DFS backtracker. Cells at odd indices are floor candidates; we carve
  // a passage through the even-indexed wall between two cells.
  const start: CellPos = { col: 1, row: 1 };
  grid[start.row][start.col] = '.';
  const stack: CellPos[] = [start];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const dirs: [number, number][] = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];
    shuffle(dirs);
    let advanced = false;
    for (const [dRow, dCol] of dirs) {
      const nRow = cur.row + dRow;
      const nCol = cur.col + dCol;
      if (nRow < 1 || nRow >= rows - 1 || nCol < 1 || nCol >= cols - 1) continue;
      if (grid[nRow][nCol] !== '#') continue;
      grid[cur.row + dRow / 2][cur.col + dCol / 2] = '.';
      grid[nRow][nCol] = '.';
      stack.push({ col: nCol, row: nRow });
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  // 2. Knock down a few random interior walls to add loops (~6% of interior walls).
  const loopBudget = Math.max(4, Math.floor((cols * rows) * 0.04));
  let knocked = 0;
  for (let attempt = 0; attempt < loopBudget * 5 && knocked < loopBudget; attempt++) {
    const r = 2 + Math.floor(Math.random() * (rows - 4));
    const c = 2 + Math.floor(Math.random() * (cols - 4));
    if (grid[r][c] !== '#') continue;
    // Only knock walls that are between two floor cells (axis-aligned).
    const horizontalBridge = grid[r][c - 1] === '.' && grid[r][c + 1] === '.';
    const verticalBridge = grid[r - 1][c] === '.' && grid[r + 1][c] === '.';
    if (horizontalBridge || verticalBridge) {
      grid[r][c] = '.';
      knocked++;
    }
  }

  // 3. BFS from spawn to find the furthest reachable floor cell — that's the exit.
  const distances = bfsDistances(grid, start);
  let exit: CellPos = { ...start };
  let maxDist = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = distances[r][c];
      if (d > maxDist && grid[r][c] === '.') {
        maxDist = d;
        exit = { col: c, row: r };
      }
    }
  }
  grid[exit.row][exit.col] = 'E';

  // 4. Find dead-end cells (1 floor neighbor) for artifacts. Skip cells too
  // close to spawn so kids don't trivially scoop them up.
  const deadEnds: CellPos[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (grid[r][c] !== '.') continue;
      if (distances[r][c] < 6) continue;
      const neighbors =
        (grid[r - 1][c] !== '#' ? 1 : 0) +
        (grid[r + 1][c] !== '#' ? 1 : 0) +
        (grid[r][c - 1] !== '#' ? 1 : 0) +
        (grid[r][c + 1] !== '#' ? 1 : 0);
      if (neighbors === 1) deadEnds.push({ col: c, row: r });
    }
  }
  shuffle(deadEnds);
  const artifacts: CellPos[] = [];
  for (let i = 0; i < Math.min(CFG.artifactCount, deadEnds.length); i++) {
    const cell = deadEnds[i];
    grid[cell.row][cell.col] = 'A';
    artifacts.push(cell);
  }

  // 5. Place traps + quicksand on random floor cells along the optimal path —
  // skip cells within 2 of spawn (no instant-fail), and skip cells already
  // taken by an artifact.
  const placeable: CellPos[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (grid[r][c] !== '.') continue;
      if (distances[r][c] < 3) continue;
      placeable.push({ col: c, row: r });
    }
  }
  shuffle(placeable);

  const traps: CellPos[] = [];
  for (let i = 0; i < Math.min(CFG.trapCount, placeable.length); i++) {
    const cell = placeable.pop();
    if (!cell) break;
    grid[cell.row][cell.col] = 'T';
    traps.push(cell);
  }
  const quicksand: CellPos[] = [];
  for (let i = 0; i < Math.min(CFG.quicksandCount, placeable.length); i++) {
    const cell = placeable.pop();
    if (!cell) break;
    grid[cell.row][cell.col] = 'Q';
    quicksand.push(cell);
  }

  // 6. Mark spawn (last so it overrides any prior label).
  grid[start.row][start.col] = 'S';

  // 7. Coalesce horizontal wall runs into rectangle physics bodies.
  const walls: WallRect[] = [];
  const t = CFG.tileSize;
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= cols; c++) {
      const isWall = c < cols && grid[r][c] === '#';
      if (isWall && runStart < 0) runStart = c;
      if (!isWall && runStart >= 0) {
        walls.push({ x: runStart * t, y: r * t, w: (c - runStart) * t, h: t });
        runStart = -1;
      }
    }
  }

  return {
    grid,
    walls,
    spawn: start,
    exit,
    artifacts,
    traps,
    quicksand,
    worldWidthPx: cols * t,
    worldHeightPx: rows * t,
  };
}

function bfsDistances(grid: Tile[][], from: CellPos): number[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const dist: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const queue: CellPos[] = [from];
  dist[from.row][from.col] = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = dist[cur.row][cur.col];
    const neighbors: [number, number][] = [
      [cur.row - 1, cur.col],
      [cur.row + 1, cur.col],
      [cur.row, cur.col - 1],
      [cur.row, cur.col + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (grid[nr][nc] === '#') continue;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = d + 1;
      queue.push({ col: nc, row: nr });
    }
  }
  return dist;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
