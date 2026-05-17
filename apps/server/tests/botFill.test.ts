import { describe, expect, it } from "vitest";
import { buildBotRowsForCount, type BotGroupSpec } from "../src/bots/botConfig.js";

const groups: BotGroupSpec[] = [
  {
    id: "conservative",
    label: "conservative",
    strategy: "conservative",
    minThinkMs: 800,
    maxThinkMs: 2600,
    hintChance: 0.15,
    correctChance: 0.7
  },
  {
    id: "bold",
    label: "bold",
    strategy: "bold",
    minThinkMs: 80,
    maxThinkMs: 200,
    hintChance: 0.025,
    correctChance: 0.7
  }
];

describe("buildBotRowsForCount", () => {
  it("returns empty for zero", () => {
    expect(buildBotRowsForCount(0, groups)).toEqual([]);
  });

  it("splits 89 bots roughly half conservative and half bold", () => {
    const rows = buildBotRowsForCount(89, groups);
    expect(rows.length).toBe(89);
    const conservative = rows.filter((r) => r.groupId === "conservative");
    const bold = rows.filter((r) => r.groupId === "bold");
    expect(conservative.length).toBe(44);
    expect(bold.length).toBe(45);
    expect(rows[0]!.displayName).toMatch(/^\[conservative:0\]/);
    expect(rows[44]!.displayName).toMatch(/^\[bold:0\]/);
  });

  it("uses group strategy specs on each row", () => {
    const rows = buildBotRowsForCount(2, groups);
    expect(rows[0]!.spec.strategy).toBe("conservative");
    expect(rows[0]!.spec.correctChance).toBe(0.7);
    expect(rows[1]!.spec.strategy).toBe("bold");
    expect(rows[1]!.spec.maxThinkMs).toBe(200);
  });
});
