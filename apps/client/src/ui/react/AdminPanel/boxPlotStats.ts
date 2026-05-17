/** 단일 그룹 박스플롯 통계 (Tukey whiskers) */
export interface BoxPlotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export function computeBoxPlotStats(values: number[]): BoxPlotStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const med = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  let whiskerMin = sorted[0]!;
  let whiskerMax = sorted[sorted.length - 1]!;
  for (const v of sorted) {
    if (v >= loFence) {
      whiskerMin = v;
      break;
    }
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]! <= hiFence) {
      whiskerMax = sorted[i]!;
      break;
    }
  }
  return {
    min: whiskerMin,
    q1,
    median: med,
    q3,
    max: whiskerMax,
    count: sorted.length
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
