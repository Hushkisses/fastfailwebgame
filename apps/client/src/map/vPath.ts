/**
 * 이동 규격: 현재 타일 (r,c)에서 (r+1,c) 또는 (r,c+1)로만 진행 가능.
 * 등각 투영에서 대각선(V) 진행 패턴과 대응.
 */
export type Cell = readonly [number, number];

export function downBranchNeighbors(row: number, col: number): readonly [Cell, Cell] {
  return [
    [row + 1, col],
    [row, col + 1]
  ] as const;
}
