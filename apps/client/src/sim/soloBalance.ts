/**
 * 서버 `apps/server/src/config/gameBalance.ts` 와 1:1 매칭되는 클라용 복사본.
 * 오프라인 솔로 모드에서만 사용. 서버 멀티 모드 결과와 동일한 룰을 보장하기 위해
 * 값이 바뀌면 서버와 함께 갱신해야 한다.
 */
export const soloBalance = {
  goalFloor: 100,

  trapBaseChance: 0.42,
  trapPerFloorRaise: 0.004,

  themeMilestoneFloors: 20,

  failEnergyBaseGrant: 0.22,
  minRunPeakForFailEnergy: 10,
  failEnergyMicroScale: 0.00095,

  baseJumpPower: 1,
  maxJumpPower: 80,
  jumpPowerTierAtFails: [10, 30, 40] as const,

  baseMoveSpeed: 4,
  maxMoveSpeed: 90,
  energySpeedGrowth: 1.065,

  walls: [] as const,

  hintCooldownMs: 10000,
  hintRevealMs: 1000,
  respawnDelayMs: 3000,
  maxTrailMarks: 400,
  maxBranchDepth: 600
} as const;

export type SoloAuraTier = "blue" | "purple" | "gold";

export function computeAuraTierEnergy(failEnergy: number): SoloAuraTier {
  const e = Math.max(0, failEnergy);
  if (e >= 600) return "gold";
  if (e >= 180) return "purple";
  return "blue";
}

export function computeFailureSpeedBoost(failCount: number): number {
  const n = Math.min(110, Math.max(0, failCount));
  return Math.min(16, Math.pow(1.072, n));
}

export function computeJumpPowerFromFailCount(failCount: number): number {
  const n = Math.floor(Math.max(0, failCount));
  const [t2, t3, t4] = soloBalance.jumpPowerTierAtFails;
  let jp = 1;
  if (n >= t4) jp = 4;
  else if (n >= t3) jp = 3;
  else if (n >= t2) jp = 2;
  return Math.min(soloBalance.maxJumpPower, Math.max(1, jp));
}

export function computeMoveSpeedFromEnergy(failEnergy: number): number {
  const e = Math.max(0, failEnergy);
  const raw = Math.min(
    soloBalance.maxMoveSpeed,
    soloBalance.baseMoveSpeed *
      Math.pow(soloBalance.energySpeedGrowth, Math.min(120, Math.log2(12 + e / 9)))
  );
  return Number(raw.toFixed(2));
}
