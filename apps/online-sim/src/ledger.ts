import type { Side } from "./config.js";

/** `resolution` 메시지 — 봇은 `blockedDuplicate` 처리에만 사용 */
export interface ResolutionPayload {
  id: string;
  success?: boolean;
  fromFloor?: number;
  toFloor?: number;
  trailMark?: { floor: number; side: string };
  blockedDuplicate?: boolean;
  respawnLocked?: boolean;
}

export interface PlayerLike {
  floor: number;
  jumpPower: number;
  currentSide: string;
  hasWon: boolean;
  failCount: number;
  bestFloorReached: number;
  failEnergy: number;
  respawnAvailableAt: number;
  revealedTrapKeys: { length: number; [index: number]: string | undefined };
}

export interface GameStateLike {
  matchPhase: string;
  players: { get(id: string): PlayerLike | undefined };
  lastRoundStats: {
    length: number;
    at?: (i: number) => RoundStatLike;
    [i: number]: RoundStatLike;
  };
}

export interface RoundStatLike {
  name: string;
  rank: number;
  failCount: number;
  bestFloorReached: number;
  currentFloor: number;
  failEnergy: number;
  hasWon: boolean;
  avgSelectionWaitSec: number;
  showRecentTileStrip: boolean;
}

function rndSide(rnd: () => number): Side {
  return rnd() < 0.5 ? "left" : "right";
}

export function pickRandomSide(rnd: () => number): Side {
  return rndSide(rnd);
}
