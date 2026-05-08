import { describe, expect, it } from "vitest";
import { gameBalance } from "../src/config/gameBalance.js";

function canUseHint(lastHintAt: number, now: number): boolean {
  return now - lastHintAt >= gameBalance.hintCooldownMs;
}

describe("hint cooldown", () => {
  it("blocks requests before 10 seconds", () => {
    const now = 20_000;
    expect(canUseHint(12_000, now)).toBe(false);
  });

  it("allows requests after 10 seconds", () => {
    const now = 20_000;
    expect(canUseHint(10_000, now)).toBe(true);
  });
});
