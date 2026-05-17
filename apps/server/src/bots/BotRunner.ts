import type { Room } from "colyseus.js";
import { LevelBranchGenerator } from "../core/grid.js";
import type { Side, StrategySpec } from "./botConfig.js";
import { pickFarthestPath, trapKnownFromList } from "./botPick.js";

export interface ResolutionPayload {
  id: string;
  blockedDuplicate?: boolean;
}

export interface PlayerLike {
  floor: number;
  jumpPower: number;
  hasWon: boolean;
  respawnAvailableAt: number;
  revealedTrapKeys: { length: number; [index: number]: string | undefined };
}

export interface GameStateLike {
  matchPhase: string;
  players: { get(id: string): PlayerLike | undefined };
}

export class BotRunner {
  readonly sessionId: string;
  nextThinkAt = 0;
  queuedPath: Side[] | null = null;
  lastSentPath: Side[] | null = null;
  private readonly branches = new LevelBranchGenerator();

  constructor(
    readonly room: Room,
    readonly displayName: string,
    readonly groupId: string,
    readonly spec: StrategySpec
  ) {
    this.sessionId = room.sessionId;
  }

  onBlockedDuplicate(): void {
    const st = this.room.state as unknown as GameStateLike;
    const me = st.players.get(this.sessionId);
    if (!me) {
      this.queuedPath = null;
      return;
    }
    const trapKnown = trapKnownFromList(me.revealedTrapKeys);
    this.queuedPath = pickFarthestPath(
      this.branches,
      me.floor,
      me.jumpPower,
      trapKnown,
      Math.random,
      this.lastSentPath ?? undefined
    );
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

    const trapKnown = trapKnownFromList(me.revealedTrapKeys);
    let path: Side[];
    if (this.queuedPath !== null) {
      path = this.queuedPath;
      this.queuedPath = null;
    } else {
      path = pickFarthestPath(this.branches, me.floor, me.jumpPower, trapKnown);
    }

    try {
      if (path.length === 1) {
        this.room.send("chooseTile", { side: path[0] });
      } else {
        this.room.send("chooseTile", { sides: path });
      }
    } catch {
      return;
    }

    this.lastSentPath = path;
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
