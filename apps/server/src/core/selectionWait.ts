import type { ResolveResult } from "./resolver.js";

/** 선택 대기 시간 누적용 (PlayerState·테스트 더블) */
export interface SelectionWaitTrackable {
  hasWon: boolean;
  respawnAvailableAt: number;
  choiceWindowOpenedAt: number;
  selectionWaitTotalMs: number;
  selectionChoiceCount: number;
}

export function resetSelectionWait(player: SelectionWaitTrackable): void {
  player.choiceWindowOpenedAt = 0;
  player.selectionWaitTotalMs = 0;
  player.selectionChoiceCount = 0;
}

/** 다음 타일 선택이 가능해진 시각(ms)을 기록 */
export function openChoiceWindow(player: SelectionWaitTrackable, atMs: number): void {
  if (player.hasWon) {
    player.choiceWindowOpenedAt = 0;
    return;
  }
  player.choiceWindowOpenedAt = atMs;
}

/** 부활 대기 중이 아니고 승리 전이면 선택 가능 */
export function canAcceptTileChoice(player: SelectionWaitTrackable, now: number): boolean {
  if (player.hasWon) return false;
  return player.respawnAvailableAt <= 0 || now >= player.respawnAvailableAt;
}

/** `chooseTile` 직전 — 열린 창이 있으면 이번 선택의 대기 시간을 누적 */
export function recordSelectionWaitOnChoose(player: SelectionWaitTrackable, now: number): void {
  const opened = player.choiceWindowOpenedAt;
  if (opened > 0) {
    player.selectionWaitTotalMs += Math.max(0, now - opened);
    player.selectionChoiceCount += 1;
  }
  player.choiceWindowOpenedAt = 0;
}

/** `resolveChoice` 직후 — 다음 선택 창 시각 예약 */
export function scheduleChoiceWindowAfterResolve(
  player: SelectionWaitTrackable,
  result: ResolveResult,
  now: number
): void {
  if (player.hasWon) {
    player.choiceWindowOpenedAt = 0;
    return;
  }
  if (result.respawnLocked) {
    return;
  }
  if (result.success) {
    openChoiceWindow(player, now);
    return;
  }
  if (player.respawnAvailableAt > now) {
    openChoiceWindow(player, player.respawnAvailableAt);
    return;
  }
  openChoiceWindow(player, now);
}

/** 라운드 종료 스냅샷: 선택당 평균 대기(초), 선택 없으면 0 */
export function averageSelectionWaitSec(player: SelectionWaitTrackable): number {
  const n = player.selectionChoiceCount;
  if (n <= 0) return 0;
  const sec = player.selectionWaitTotalMs / n / 1000;
  return Number(sec.toFixed(2));
}
