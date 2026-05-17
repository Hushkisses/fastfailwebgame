import { describe, expect, it } from "vitest";
import { assignShowRecentTileStrip } from "../src/core/recentTileStripCohort.js";

describe("assignShowRecentTileStrip", () => {
  it("assigns to minority group", () => {
    expect(assignShowRecentTileStrip([true, true, false])).toBe(false);
    expect(assignShowRecentTileStrip([false, false, true])).toBe(true);
  });
});
