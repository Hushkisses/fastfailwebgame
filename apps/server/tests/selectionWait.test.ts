import { describe, expect, it } from "vitest";
import {
  averageSelectionWaitSec,
  canAcceptTileChoice,
  openChoiceWindow,
  recordSelectionWaitOnChoose,
  resetSelectionWait,
  scheduleChoiceWindowAfterResolve,
  type SelectionWaitTrackable
} from "../src/core/selectionWait.js";

function trackable(overrides: Partial<SelectionWaitTrackable> = {}): SelectionWaitTrackable {
  return {
    hasWon: false,
    respawnAvailableAt: 0,
    choiceWindowOpenedAt: 0,
    selectionWaitTotalMs: 0,
    selectionChoiceCount: 0,
    ...overrides
  };
}

describe("selectionWait", () => {
  it("accumulates wait on choose and averages in seconds", () => {
    const p = trackable();
    openChoiceWindow(p, 1000);
    recordSelectionWaitOnChoose(p, 2500);
    scheduleChoiceWindowAfterResolve(p, { success: true, fromFloor: 1, toFloor: 2 }, 2500);
    openChoiceWindow(p, 2500);
    recordSelectionWaitOnChoose(p, 4000);
    expect(p.selectionChoiceCount).toBe(2);
    expect(p.selectionWaitTotalMs).toBe(1500 + 1500);
    expect(averageSelectionWaitSec(p)).toBe(1.5);
  });

  it("opens window after fall at respawn time", () => {
    const p = trackable({ respawnAvailableAt: 5000 });
    scheduleChoiceWindowAfterResolve(
      p,
      { success: false, fromFloor: 3, toFloor: 1, trailMark: { floor: 3, side: "left", timestamp: 2000 } },
      2000
    );
    expect(p.choiceWindowOpenedAt).toBe(5000);
  });

  it("does not count respawn-locked period as choosable", () => {
    const p = trackable({ respawnAvailableAt: 5000 });
    expect(canAcceptTileChoice(p, 3000)).toBe(false);
    expect(canAcceptTileChoice(p, 5000)).toBe(true);
  });

  it("resets tracking for new round", () => {
    const p = trackable({
      choiceWindowOpenedAt: 1,
      selectionWaitTotalMs: 9000,
      selectionChoiceCount: 3
    });
    resetSelectionWait(p);
    expect(p.selectionWaitTotalMs).toBe(0);
    expect(p.selectionChoiceCount).toBe(0);
    expect(p.choiceWindowOpenedAt).toBe(0);
  });
});
