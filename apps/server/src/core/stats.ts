import { gameBalance } from "../config/gameBalance.js";

export interface PlayerStats {
  jumpPower: number;
  moveSpeed: number;
}

/**
 * 실패 부활 횟수로 이동 속도 지수 배율 (복구 후 질주감).
 */
export function computeFailureSpeedBoost(failCount: number): number {
  const n = Math.min(110, Math.max(0, failCount));
  return Math.min(16, Math.pow(1.072, n));
}

/**
 * 누적 실패 횟수 → 점프 층수 (에너지와 분리된 완만한 성장 곡선).
 * 0–9회: 1, 10–29회: 2, 30–39회: 3, 40회 이상: 4 (이후 필요 시 게임 밸런스 테이블로 확장).
 */
export function computeJumpPowerFromFailCount(failCount: number): number {
  const n = Math.floor(Math.max(0, failCount));
  const [t2, t3, t4] = gameBalance.jumpPowerTierAtFails;
  let jp = 1;
  if (n >= t4) jp = 4;
  else if (n >= t3) jp = 3;
  else if (n >= t2) jp = 2;
  return Math.min(gameBalance.maxJumpPower, Math.max(1, jp));
}

function computeMoveSpeedFromEnergyRaw(failEnergy: number): number {
  const e = Math.max(0, failEnergy);
  return Math.min(
    gameBalance.maxMoveSpeed,
    gameBalance.baseMoveSpeed *
      Math.pow(gameBalance.energySpeedGrowth, Math.min(120, Math.log2(12 + e / 9)))
  );
}

/** Fail-Energy → 이동 속도만 (점프는 `computeJumpPowerFromFailCount`). */
export function computeMoveSpeedFromEnergy(failEnergy: number): number {
  return Number(computeMoveSpeedFromEnergyRaw(failEnergy).toFixed(2));
}

/**
 * 점프는 `failCount`, 속도는 `failEnergy`.
 * 테스트·호환용: `computeStatsFromEnergy(e)` → failCount 0 전제 시 점프 1.
 */
export function computeStatsFromEnergy(failEnergy: number, failCount = 0): PlayerStats {
  return {
    jumpPower: computeJumpPowerFromFailCount(failCount),
    moveSpeed: computeMoveSpeedFromEnergy(failEnergy)
  };
}
