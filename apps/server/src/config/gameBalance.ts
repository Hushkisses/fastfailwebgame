export const gameBalance = {

  /** 승리: 이 층 이상 도달 */

  goalFloor: 100,

  /** 레벨 높을수록 XOR 함정 비중 상승 시드에 사용 */

  trapBaseChance: 0.42,

  trapPerFloorRaise: 0.004,



  themeMilestoneFloors: 20,



  /** 실패 보상 기본 스케일 (이번 런 최고층이 minRunPeakForFailEnergy 이상일 때 본 보상) */

  failEnergyBaseGrant: 0.22,

  /** 이 층 미만이면 거의 0 (같은 낮은 층 노가다 방지) */

  minRunPeakForFailEnergy: 10,

  /** min 미만일 때 peak²에 비례하는 미세 보상 상한에 쓰는 계수 */

  failEnergyMicroScale: 0.00095,



  /** 점프력은 `failEnergy`가 아니라 `failCount` 구간으로만 상승 (stats.ts 참고) */

  baseJumpPower: 1,

  maxJumpPower: 80,

  /** 실패 횟수가 이 값 이상이면 점프력 단계 증가: [미만)→1 ([a,b)[→2 등) */
  jumpPowerTierAtFails: [10, 30, 40] as const,

  baseMoveSpeed: 4,

  maxMoveSpeed: 90,

  energySpeedGrowth: 1.065,



  /** 절벽 조건 없음: 안전한 선택이면 특정 층 라인에서 추가로 막히지 않음. */
  walls: [],



  hintCooldownMs: 10000,

  /** 힌트 사용 시 안전 패널이 밝아지는 지속 시간 (ms) */
  hintRevealMs: 1000,

  respawnDelayMs: 3000,

  serverPatchRateMs: 50,

  maxTrailMarks: 400,

  maxBranchDepth: 600

} as const;



export type AuraTier = "blue" | "purple" | "gold";


