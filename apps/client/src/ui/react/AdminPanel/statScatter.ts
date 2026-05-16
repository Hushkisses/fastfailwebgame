import type { StatRowView } from "./statTypes";

/** 산점도에 쓰는 숫자형 통계 열 */
export type NumericStatKey = "rank" | "failCount" | "bestFloorReached" | "currentFloor" | "failEnergy";

export const NUMERIC_STAT_KEYS: NumericStatKey[] = [
  "failCount",
  "currentFloor",
  "bestFloorReached",
  "rank",
  "failEnergy"
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

export function scaleLinear(v: number, domain: PlotDomain, rangeMin: number, rangeMax: number): number {
  const span = domain.max - domain.min;
  if (span <= 0) return (rangeMin + rangeMax) / 2;
  const t = (v - domain.min) / span;
  return rangeMax - t * (rangeMax - rangeMin);
}

/** 봇 그룹 색 — `[conservative:0]` 접두 */
export function pointColor(name: string): string {
  if (name.startsWith("[conservative:")) return "#4a7fc8";
  if (name.startsWith("[bold:")) return "#c85a4a";
  return "#6a48c8";
}
