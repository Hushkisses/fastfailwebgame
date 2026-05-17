import { describe, expect, it } from "vitest";
import { LevelBranchGenerator } from "../src/core/grid.js";
import { buildPickTargets, pickBotPath, pickFarthestPath } from "../src/bots/botPick.js";
import { trapRevealKey } from "../src/core/resolver.js";

describe("botPick", () => {
  it("left safe rate is about 60% over precomputed floors", () => {
    const gen = new LevelBranchGenerator();
    gen.setRoundSeed(42);
    gen.precomputeAll();
    let leftSafe = 0;
    const n = 200;
    for (let level = 1; level <= n; level++) {
      if (gen.getBranch(level).leftSafe) leftSafe += 1;
    }
    const ratio = leftSafe / n;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(0.7);
  });

  it("includes farther hops when jumpPower allows", () => {
    const gen = new LevelBranchGenerator();
    gen.setRoundSeed(1);
    gen.precomputeAll();
    const targets = buildPickTargets(gen, 5, 3, new Set());
    const maxLen = Math.max(...targets.map((t) => t.path.length));
    expect(maxLen).toBe(3);
    expect(targets.some((t) => t.path.length === 1)).toBe(true);
  });

  it("pickFarthestPath prefers maximum path length", () => {
    const gen = new LevelBranchGenerator();
    gen.setRoundSeed(2);
    gen.precomputeAll();
    let i = 0;
    const rnd = () => {
      i += 1;
      return 0;
    };
    const path = pickFarthestPath(gen, 10, 4, new Set(), rnd);
    const targets = buildPickTargets(gen, 10, 4, new Set());
    const maxLen = Math.max(...targets.map((t) => t.path.length));
    expect(path.length).toBe(maxLen);
  });

  it("excludes last path on blocked duplicate retry", () => {
    const gen = new LevelBranchGenerator();
    const targets = buildPickTargets(gen, 8, 2, new Set());
    const twoHop = targets.filter((t) => t.path.length === 2);
    if (twoHop.length < 2) return;

    const first = twoHop[0]!.path;
    const again = pickFarthestPath(gen, 8, 2, new Set(), () => 0.99, first);
    expect(again.join(",")).not.toBe(first.join(","));
  });

  it("skips known trap keys", () => {
    const gen = new LevelBranchGenerator();
    const trapKnown = new Set([trapRevealKey(5, "left")]);
    const targets = buildPickTargets(gen, 5, 1, trapKnown);
    expect(targets.every((t) => !(t.floor === 5 && t.side === "left"))).toBe(true);
  });

  it("pickBotPath bold picks maximum path length without oracle", () => {
    const gen = new LevelBranchGenerator();
    const path = pickBotPath("bold", gen, 10, 4, new Set(), () => 0);
    const boldTargets = buildPickTargets(gen, 10, 4, new Set(), false);
    const maxLen = Math.max(...boldTargets.map((t) => t.path.length));
    expect(path.length).toBe(maxLen);
  });

  it("pickBotPath conservative with correctChance 1 picks fully safe farthest", () => {
    const gen = new LevelBranchGenerator();
    const path = pickBotPath("conservative", gen, 10, 4, new Set(), () => 0, undefined, 1);
    const maxLen = path.length;
    for (let i = 0; i < path.length; i++) {
      expect(gen.isChoiceSafe(10 + i, path[i]!)).toBe(true);
    }
    const targets = buildPickTargets(gen, 10, 4, new Set(), true);
    const farthest = targets.filter((t) => t.path.length === maxLen);
    expect(farthest.some((t) => t.path.join(",") === path.join(","))).toBe(true);
  });
});
