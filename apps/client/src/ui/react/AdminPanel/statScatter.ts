import type { StatRowView } from "./statTypes";

/** 산점도에 쓰는 숫자형 통계 열 */
export type NumericStatKey =
  | "rank"
  | "failCount"
  | "bestFloorReached"
  | "currentFloor"
  | "failEnergy"
  | "avgSelectionWaitSec";

export const NUMERIC_STAT_KEYS: NumericStatKey[] = [
  "failCount",
  "currentFloor",
  "bestFloorReached",
  "rank",
  "failEnergy",
  "avgSelectionWaitSec"
];

export const PRIMARY_STAT_PAIRS: [NumericStatKey, NumericStatKey][] = [
  ["failCount", "currentFloor"],
  ["failCount", "bestFloorReached"]
];

const PRIORITY_PAIRS = PRIMARY_STAT_PAIRS;

function pairKey(a: NumericStatKey, b: NumericStatKey): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 기본 산점도 2개 (실패횟수 × 현재층 / 최고층) */
export function primaryStatPairs(): [NumericStatKey, NumericStatKey][] {
  return [...PRIMARY_STAT_PAIRS];
}

/** 우선 쌍 + 나머지 숫자 변수 조합 전체 */
export function allNumericStatPairs(): [NumericStatKey, NumericStatKey][] {
  const seen = new Set<string>();
  const out: [NumericStatKey, NumericStatKey][] = [];

  const push = (a: NumericStatKey, b: NumericStatKey): void => {
    const k = pairKey(a, b);
    if (seen.has(k)) return;
    seen.add(k);
    out.push([a, b]);
  };

  for (const [a, b] of PRIORITY_PAIRS) {
    push(a, b);
  }

  for (let i = 0; i < NUMERIC_STAT_KEYS.length; i++) {
    for (let j = i + 1; j < NUMERIC_STAT_KEYS.length; j++) {
      push(NUMERIC_STAT_KEYS[i]!, NUMERIC_STAT_KEYS[j]!);
    }
  }

  return out;
}

export function statValue(row: StatRowView, key: NumericStatKey): number {
  switch (key) {
    case "rank":
      return row.rank;
    case "failCount":
      return row.failCount;
    case "bestFloorReached":
      return row.bestFloorReached;
    case "currentFloor":
      return row.currentFloor;
    case "failEnergy":
      return row.failEnergy;
    case "avgSelectionWaitSec":
      return row.avgSelectionWaitSec;
  }
}

export interface PlotDomain {
  min: number;
  max: number;
}

export function computeDomain(values: number[]): PlotDomain {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1 + 1;
    return { min: min - pad, max: max + pad };
  }
  const span = max - min;
  const pad = span * 0.06;
  return { min: min - pad, max: max + pad };
}

/** 값 → 픽셀. `invert` false: 작은 값이 rangeMin(가로축=왼쪽, 세로축=아래) */
export function scaleLinear(
  v: number,
  domain: PlotDomain,
  rangeMin: number,
  rangeMax: number,
  invert = false
): number {
  const span = domain.max - domain.min;
  if (span <= 0) return (rangeMin + rangeMax) / 2;
  const t = (v - domain.min) / span;
  if (invert) {
    return rangeMax - t * (rangeMax - rangeMin);
  }
  return rangeMin + t * (rangeMax - rangeMin);
}

/** 순위는 숫자가 작을수록 좋음 → 축 방향을 반대로 둠 (1위가 오른쪽/위) */
export function isLowerBetter(key: NumericStatKey): boolean {
  return key === "rank";
}

/** 가로축: 값이 클수록 오른쪽 (순위 축만 반전 → 1위가 오른쪽) */
export function scaleAxisX(
  v: number,
  domain: PlotDomain,
  left: number,
  right: number,
  key: NumericStatKey
): number {
  return scaleLinear(v, domain, left, right, isLowerBetter(key));
}

/** 세로축: 값이 클수록 위 (순위 축만 반전 → 1위가 위) */
export function scaleAxisY(
  v: number,
  domain: PlotDomain,
  top: number,
  bottom: number,
  key: NumericStatKey
): number {
  return scaleLinear(v, domain, top, bottom, !isLowerBetter(key));
}

/** 실험 군(막대 UI) 우선, 그다음 봇 접두 */
export function pointColor(row: StatRowView): string {
  if (row.showRecentTileStrip) return "#1a8fd8";
  if (row.name.startsWith("[conservative:")) return "#4a7fc8";
  if (row.name.startsWith("[bold:")) return "#c85a4a";
  return "#94a3b8";
}
