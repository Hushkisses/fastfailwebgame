import { describe, expect, it } from "vitest";
import { resolveChoice, simulateFailCharge, trapRevealKey } from "../src/core/resolver.js";
import { LevelBranchGenerator } from "../src/core/grid.js";
import { PlayerState } from "../src/rooms/schema/GameState.js";
import { gameBalance } from "../src/config/gameBalance.js";

function makePlayer(floor = 10): PlayerState {
  const p = new PlayerState();
  p.id = "test";
  p.floor = floor;
  p.runPeakFloor = floor;
  p.bestFloorReached = floor;
  p.jumpPower = 12;
  p.failEnergy = 300;
  return p;
}

/** 층 `from`부터 길이 `len`의 안전 경로 (매 층 XOR 안전패널만) */
function safePath(grid: LevelBranchGenerator, from: number, len: number): ("left" | "right")[] {
  const out: ("left" | "right")[] = [];
  for (let i = 0; i < len; i++) {
    const b = grid.getBranch(from + i);
    out.push(b.leftSafe ? "left" : "right");
  }
  return out;
}

describe("resolveChoice level climb", () => {
  const grid = new LevelBranchGenerator();

  it("advances by path length on safe multi-hop", () => {
    const p = makePlayer(5);
    const hops = Math.max(1, Math.floor(p.jumpPower));
    const path = safePath(grid, 5, hops);
    const r = resolveChoice(p, path, grid, Date.now());
    expect(r.success).toBe(true);
    expect(p.floor).toBe(Math.min(gameBalance.goalFloor, 5 + path.length));
    expect(p.currentSide).toBe(path[path.length - 1]);
  });

  it("single safe hop moves one floor", () => {
    const p = makePlayer(8);
    const path = safePath(grid, 8, 1);
    const r = resolveChoice(p, path, grid, Date.now());
    expect(r.success).toBe(true);
    expect(p.floor).toBe(9);
  });

  it("falls on first trap in path", () => {
    const p = makePlayer(14);
    const branch = grid.getBranch(14);
    const unsafe: "left" | "right" = branch.leftSafe ? "right" : "left";
    const beforeEnergy = p.failEnergy;
    const r = resolveChoice(p, [unsafe], grid, Date.now());
    expect(r.success).toBe(false);
    expect(p.floor).toBe(1);
    expect(p.failEnergy).toBeGreaterThan(beforeEnergy);
    expect(r.gainedEnergy).toBeGreaterThan(0);
  });

  it("simulateFailCharge grows with peak floor", () => {
    expect(simulateFailCharge(40)).toBeGreaterThan(simulateFailCharge(14));
  });

  it("low run peak yields near-zero reward", () => {
    expect(simulateFailCharge(3)).toBe(0);
    expect(simulateFailCharge(12)).toBeLessThan(simulateFailCharge(30));
  });

  it("blocks picks during respawn delay after fall", () => {
    const p = makePlayer(18);
    const branch = grid.getBranch(18);
    const trapSide = branch.leftSafe ? ("right" as const) : ("left" as const);
    const t0 = 1_010_000;
    resolveChoice(p, [trapSide], grid, t0);
    expect(p.floor).toBe(1);
    expect(p.respawnAvailableAt).toBeGreaterThan(t0);
    const safe = grid.getBranch(1).leftSafe ? ("left" as const) : ("right" as const);
    const locked = resolveChoice(p, [safe], grid, t0 + 900);
    expect(locked.respawnLocked).toBe(true);

    const after = resolveChoice(p, [safe], grid, t0 + 4000);
    expect(after.success).toBe(true);
    expect(after.blockedDuplicate).not.toBe(true);
  });

  it("rejects replaying a known trap tile for that player", () => {
    const p = makePlayer(25);
    const branch = grid.getBranch(25);
    const trapSide = branch.leftSafe ? ("right" as const) : ("left" as const);
    const t0 = 3_000_000;
    resolveChoice(p, [trapSide], grid, t0);
    expect(p.floor).toBe(1);
    p.floor = 25;

    const r = resolveChoice(p, [trapSide], grid, t0 + 4000);
    expect(r.blockedDuplicate).toBe(true);
    expect(r.toFloor).toBe(25);
    expect(trapRevealKey(25, trapSide)).toBeTruthy();
    expect(trapRevealKey(25, trapSide).includes("|")).toBe(true);
  });

  it("rejects path longer than jumpPower", () => {
    const p = makePlayer(30);
    p.jumpPower = 2;
    const path = safePath(grid, 30, 5);
    const r = resolveChoice(p, path, grid, Date.now());
    expect(r.success).toBe(false);
    expect(p.floor).toBe(30);
  });

  it("rejects path overshooting goal floor", () => {
    const p = makePlayer(99);
    p.jumpPower = 2;
    const path = safePath(grid, 99, 2);
    expect(99 + path.length).toBeGreaterThan(gameBalance.goalFloor);
    const r = resolveChoice(p, path, grid, Date.now());
    expect(r.success).toBe(false);
    expect(p.floor).toBe(99);
  });
});
