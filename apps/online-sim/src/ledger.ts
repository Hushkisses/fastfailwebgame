import type { Room } from "colyseus.js";
import type { Side } from "./config.js";

export interface ResolutionPayload {
  id: string;
  success: boolean;
  fromFloor: number;
  toFloor: number;
  trailMark?: { floor: number; side: string };
  blockedDuplicate?: boolean;
  respawnLocked?: boolean;
}

export interface PlayerLike {
  floor: number;
  currentSide: string;
  hasWon: boolean;
  failCount: number;
  bestFloorReached: number;
  failEnergy: number;
  respawnAvailableAt: number;
  revealedTrapKeys?: { length: number; at?: (i: number) => string; [i: number]: string };
}

export interface GameStateLike {
  matchPhase: string;
  players: { get(id: string): PlayerLike | undefined };
  trails: { length: number; at?: (i: number) => { floor: number; side: string }; [i: number]: { floor: number; side: string } };
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
}

export class ObservationLedger {
  readonly badSideByFloor = new Map<number, Side>();
  readonly safeSideByFloor = new Map<number, Side>();
  private readonly pendingSuccessReads: { playerId: string; fromFloor: number }[] = [];

  noteResolution(msg: ResolutionPayload): void {
    if (msg.trailMark && typeof msg.trailMark.floor === "number") {
      const sd = msg.trailMark.side;
      if (sd === "left" || sd === "right") {
        this.badSideByFloor.set(msg.trailMark.floor, sd);
      }
    }
    if (msg.success && msg.toFloor === msg.fromFloor + 1 && msg.id) {
      this.pendingSuccessReads.push({ playerId: msg.id, fromFloor: msg.fromFloor });
    }
  }

  syncFromRoom(room: Room): void {
    const st = room.state as unknown as GameStateLike;
    const pending = this.pendingSuccessReads.splice(0);
    for (const p of pending) {
      const pl = st.players?.get?.(p.playerId);
      if (pl && pl.floor === p.fromFloor + 1) {
        const cs = pl.currentSide;
        if (cs === "left" || cs === "right") {
          this.safeSideByFloor.set(p.fromFloor, cs);
        }
      }
    }
    const trails = st.trails;
    if (trails && typeof trails.length === "number") {
      const n = trails.length;
      for (let i = 0; i < n; i++) {
        const t = trails.at ? trails.at(i) : trails[i];
        if (t && typeof t.floor === "number") {
          const s = t.side;
          if (s === "left" || s === "right") this.badSideByFloor.set(t.floor, s);
        }
      }
    }
  }
}

export function ownKnownBadSides(me: PlayerLike, floor: number): Side[] {
  const bad: Side[] = [];
  const keys = me.revealedTrapKeys;
  if (!keys || typeof keys.length !== "number") return bad;
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const k = keys.at ? keys.at(i) : keys[i];
    if (typeof k !== "string") continue;
    const pipe = k.indexOf("|");
    if (pipe < 0) continue;
    const f = Number(k.slice(0, pipe));
    const s = k.slice(pipe + 1);
    if (f === floor && (s === "left" || s === "right")) bad.push(s);
  }
  return bad;
}

function opposite(s: Side): Side {
  return s === "left" ? "right" : "left";
}

function rndSide(rnd: () => number): Side {
  return rnd() < 0.5 ? "left" : "right";
}

export function blockingAheadSameFloor(
  myId: string,
  mySlot: number,
  sessionOrder: string[],
  state: GameStateLike,
  now: number
): boolean {
  const me = state.players.get(myId);
  if (!me || me.hasWon) return false;
  const myF = me.floor;
  for (let idx = 0; idx < mySlot; idx++) {
    const oid = sessionOrder[idx]!;
    const p = state.players.get(oid);
    if (!p || p.hasWon) continue;
    if (p.floor !== myF) continue;
    if (p.respawnAvailableAt > now) continue;
    return true;
  }
  return false;
}

export function pickOpportunisticSide(
  myId: string,
  mySlot: number,
  sessionOrder: string[],
  room: Room,
  ledger: ObservationLedger,
  spec: Extract<import("./config.js").StrategySpec, { strategy: "opportunistic" }>,
  rnd: () => number
): Side | null {
  const state = room.state as unknown as GameStateLike;
  if (state.matchPhase !== "playing") return null;
  const me = state.players.get(myId);
  if (!me || me.hasWon) return null;
  const now = Date.now();
  if (me.respawnAvailableAt > now) return null;

  if (blockingAheadSameFloor(myId, mySlot, sessionOrder, state, now)) {
    return null;
  }

  if (rnd() < spec.firstMoveEpsilon) {
    return rndSide(rnd);
  }

  const f = me.floor;
  const safe = ledger.safeSideByFloor.get(f);
  if (safe === "left" || safe === "right") return safe;

  const bad = ledger.badSideByFloor.get(f);
  if (bad === "left" || bad === "right") return opposite(bad);

  const ownBad = ownKnownBadSides(me, f);
  const candidates: Side[] = [];
  for (const s of ["left", "right"] as const) {
    if (!ownBad.includes(s)) candidates.push(s);
  }
  if (candidates.length === 0) return rndSide(rnd);
  return candidates[Math.floor(rnd() * candidates.length)]!;
}

export function pickRandomSide(rnd: () => number): Side {
  return rndSide(rnd);
}
