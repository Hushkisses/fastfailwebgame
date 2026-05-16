import type { Room } from "colyseus.js";
import type { Side, StrategySpec } from "./botConfig.js";

export interface ResolutionPayload {
  id: string;
  blockedDuplicate?: boolean;
}

export interface PlayerLike {
  hasWon: boolean;
  respawnAvailableAt: number;
}

export interface GameStateLike {
  matchPhase: string;
  players: { get(id: string): PlayerLike | undefined };
}

function oppositeSide(s: Side): Side {
  return s === "left" ? "right" : "left";
}

function pickRandomSide(): Side {
  return Math.random() < 0.5 ? "left" : "right";
}

export class BotRunner {
  readonly sessionId: string;
  nextThinkAt = 0;
  queuedSide: Side | null = null;
  lastSentSide: Side | null = null;

  constructor(
    readonly room: Room,
    readonly displayName: string,
    readonly groupId: string,
    readonly spec: StrategySpec
  ) {
    this.sessionId = room.sessionId;
  }

  onBlockedDuplicate(): void {
    this.queuedSide = this.lastSentSide !== null ? oppositeSide(this.lastSentSide) : pickRandomSide();
  }

  tick(now: number): void {
    const st = this.room.state as unknown as GameStateLike;
    if (st.matchPhase !== "playing") return;

    if (now < this.nextThinkAt) return;

    const me = st.players.get(this.sessionId);
    if (!me || me.hasWon) return;
    if (me.respawnAvailableAt > now) {
      this.nextThinkAt = now + 120;
      return;
    }

    if (Math.random() < this.spec.hintChance) {
      try {
        this.room.send("requestHint");
      } catch {
        /* noop */
      }
    }

    let side: Side;
    if (this.queuedSide !== null) {
      side = this.queuedSide;
      this.queuedSide = null;
    } else {
      side = pickRandomSide();
    }

    try {
      this.room.send("chooseTile", { side });
    } catch {
      return;
    }

    this.lastSentSide = side;
    const gap =
      this.spec.minThinkMs + Math.random() * (this.spec.maxThinkMs - this.spec.minThinkMs);
    this.nextThinkAt = now + Math.max(80, gap);
  }
}

export function wireResolution(room: Room, botBySession: Map<string, BotRunner>): void {
  room.onMessage("resolution", (msg: unknown) => {
    const m = msg as ResolutionPayload;
    if (m.blockedDuplicate && m.id) {
      botBySession.get(m.id)?.onBlockedDuplicate();
    }
  });
}
