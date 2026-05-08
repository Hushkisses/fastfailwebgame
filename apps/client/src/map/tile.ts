export type TileType = "safe" | "trap";

export interface Tile {
  type: TileType;
  /** 격자 Z: 솟아 있는 단계. 화면 Y는 height * TILE_DEPTH 만큼 위로 당김 */
  height: number;
  /** 누군가 밟아 타입 식별이 드러났을 때 true */
  isRevealed: boolean;
  /** 이 칸에서의 누적 추락 수 — X 두께·강도에 사용 */
  failCount: number;
}
