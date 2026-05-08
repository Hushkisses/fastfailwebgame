import { describe, expect, it } from "vitest";
import {
  computeJumpPowerFromFailCount,
  computeMoveSpeedFromEnergy,
  computeStatsFromEnergy
} from "../src/core/stats.js";
import { gameBalance } from "../src/config/gameBalance.js";

describe("computeJumpPowerFromFailCount", () => {
  it("starts at 1 and steps at configured fail milestones", () => {
    expect(computeJumpPowerFromFailCount(0)).toBe(1);
    expect(computeJumpPowerFromFailCount(9)).toBe(1);
    expect(computeJumpPowerFromFailCount(10)).toBe(2);
    expect(computeJumpPowerFromFailCount(29)).toBe(2);
    expect(computeJumpPowerFromFailCount(30)).toBe(3);
    expect(computeJumpPowerFromFailCount(39)).toBe(3);
    expect(computeJumpPowerFromFailCount(40)).toBe(4);
    expect(computeJumpPowerFromFailCount(999)).toBe(4);
  });

  it("matches gameBalance tier list length", () => {
    expect(gameBalance.jumpPowerTierAtFails).toEqual([10, 30, 40]);
  });
});

describe("computeMoveSpeedFromEnergy", () => {
  it("baseline energy keeps modest speed", () => {
    const z = computeMoveSpeedFromEnergy(0);
    expect(z).toBeGreaterThanOrEqual(gameBalance.baseMoveSpeed * 0.99);
    expect(z).toBeLessThanOrEqual(12);
  });

  it("accelerates when energy piles up", () => {
    const mid = computeMoveSpeedFromEnergy(120);
    const hi = computeMoveSpeedFromEnergy(950);
    expect(hi).toBeGreaterThan(mid);
  });

  it("respects move speed cap", () => {
    expect(computeMoveSpeedFromEnergy(999999)).toBeLessThanOrEqual(gameBalance.maxMoveSpeed);
  });
});

describe("computeStatsFromEnergy", () => {
  it("defaults jump to 1 when failCount omitted (energy-only call)", () => {
    const z = computeStatsFromEnergy(0);
    expect(z.jumpPower).toBe(1);
    expect(z.moveSpeed).toBe(computeMoveSpeedFromEnergy(0));
  });

  it("ties jump to failCount when provided", () => {
    const s = computeStatsFromEnergy(500, 35);
    expect(s.jumpPower).toBe(3);
    expect(s.moveSpeed).toBe(computeMoveSpeedFromEnergy(500));
  });
});
