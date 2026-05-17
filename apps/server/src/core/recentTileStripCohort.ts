/** 방 인원의 최근 타일 막대 UI — 접속 시 소수 그룹에 배정해 약 50:50 유지 */
export function assignShowRecentTileStrip(existingFlags: readonly boolean[]): boolean {
  let shown = 0;
  let hidden = 0;
  for (const flag of existingFlags) {
    if (flag) shown += 1;
    else hidden += 1;
  }
  if (shown < hidden) return true;
  if (hidden < shown) return false;
  return Math.random() < 0.5;
}
