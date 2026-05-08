import type { Tile } from "./tile";

const ROWS = 10;
const COLS = 10;

function seeded01(row: number, col: number): number {
  const x = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * 10×10 쿼터뷰 맵 초기 타일 생성 (데모용: 일부 trap 배치).
 */
export function createQuotaGrid10(): Tile[][] {
  const grid: Tile[][] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const line: Tile[] = [];
    for (let col = 0; col < COLS; col += 1) {
      const trap = seeded01(row, col) < 0.18 && !(row === 0 && col === 0);
      const hnoise = seeded01(col + 3, row + 41);
      const height = trap ? Math.floor(hnoise * 3) + 1 : Math.floor(hnoise * 5);
      line.push({
        type: trap ? "trap" : "safe",
        height,
        isRevealed: false,
        failCount: 0
      });
    }
    grid.push(line);
  }
  outer: for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const t = grid[row][col];
      if (t.type === "trap") {
        t.isRevealed = true;
        t.failCount = Math.max(t.failCount, 8);
        break outer;
      }
    }
  }
  return grid;
}

export const QUOTA_ROWS = ROWS;
export const QUOTA_COLS = COLS;
