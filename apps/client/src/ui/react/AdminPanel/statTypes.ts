export interface StatRowView {
  name: string;
  rank: number;
  failCount: number;
  bestFloorReached: number;
  currentFloor: number;
  failEnergy: number;
  /** 선택당 평균 대기(초) */
  avgSelectionWaitSec: number;
  /** 최근 타일 막대 UI 표시 그룹 */
  showRecentTileStrip: boolean;
}
