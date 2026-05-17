/**
 * 클라이언트 statScatter.ts 와 동일한 수식 — 회귀·상관 검증용
 */
import { describe, expect, it } from "vitest";

function mean(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    sxx += dx * dx;
    sxy += dx * (ys[i]! - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

describe("scatter regression", () => {
  it("perfect positive correlation", () => {
    const xs = [1, 2, 3, 4];
    const ys = [2, 4, 6, 8];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
    const reg = linearRegression(xs, ys)!;
    expect(reg.slope).toBeCloseTo(2, 5);
    expect(reg.intercept).toBeCloseTo(0, 5);
  });
});
