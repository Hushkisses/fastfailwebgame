/** 서버 `gameBalance`와 동일한 값 — XOR 맵 시드용 (클라 반짝/경로 추론) */
export const branchBalance = {
  /** 좌측이 정답(안전)인 층 비율 — 우측은 1 - 이 값 */
  safeSideLeftChance: 0.6,
  maxBranchDepth: 600
} as const;
