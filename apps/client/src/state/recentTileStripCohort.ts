/** 솔로 등 서버 없이 플레이할 때 동일한 50:50 배정 규칙 */
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
