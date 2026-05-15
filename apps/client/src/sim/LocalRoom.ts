/**
 * Colyseus `Room` 표면을 흉내 내는 오프라인 솔로용 어댑터.
 * `main.ts` 에서 실제 멀티 Room 과 같은 모양으로 쓸 수 있도록 최소한의 메서드만 제공.
 *
 * 지원 메시지: chooseTile, requestHint
 * 발신 이벤트: resolution, hintGranted, hintRejected
 */
import { LevelBranchGenerator, type Side } from "../logic/levelBranch";
import { soloBalance } from "./soloBalance";
import {
  createSoloPlayer,
  refreshPlayerStats,
  resolveChoice,
  type SoloHint,
  type SoloPlayer,
  type SoloTrail
} from "./soloPlayer";

type Listener = (msg: unknown) => void;

interface ChooseTileMsg {
  side?: Side;
  sides?: Side[];
}

class SoloPlayerMap {
  private map = new Map<string, SoloPlayer>();
  forEach(cb: (value: SoloPlayer, key: string) => void): void {
    this.map.forEach(cb);
  }
  get(key: string): SoloPlayer | undefined {
    return this.map.get(key);
  }
  set(key: string, p: SoloPlayer): void {
    this.map.set(key, p);
  }
}

class SoloHintMap {
  private map = new Map<string, SoloHint>();
  forEach(cb: (value: SoloHint, key: string) => void): void {
    this.map.forEach(cb);
  }
  set(key: string, h: SoloHint): void {
    this.map.set(key, h);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

export class LocalRoomState {
  players = new SoloPlayerMap();
  trails: SoloTrail[] = [];
  hints = new SoloHintMap();
}

export class LocalRoom {
  readonly sessionId = "solo";
  readonly state = new LocalRoomState();
  private readonly branches = new LevelBranchGenerator();
  private readonly listeners = new Map<string, Listener>();
  private readonly anyListeners: ((type: string, msg: unknown) => void)[] = [];
  private readonly self: SoloPlayer;

  constructor(name: string) {
    this.self = createSoloPlayer(this.sessionId, name);
    refreshPlayerStats(this.self);
    this.state.players.set(this.sessionId, this.self);
  }

  onMessage(type: "*", cb: (type: string, msg: unknown) => void): void;
  onMessage(type: string, cb: Listener): void;
  onMessage(type: string, cb: Listener | ((type: string, msg: unknown) => void)): void {
    if (type === "*") {
      this.anyListeners.push(cb as (type: string, msg: unknown) => void);
    } else {
      this.listeners.set(type, cb as Listener);
    }
  }

  send(type: string, payload?: unknown): void {
    if (type === "chooseTile") return this.handleChooseTile(payload as ChooseTileMsg | undefined);
    if (type === "requestHint") return this.handleRequestHint();
  }

  leave(): Promise<number> {
    return Promise.resolve(0);
  }

  private emit(type: string, msg: unknown): void {
    const direct = this.listeners.get(type);
    if (direct) direct(msg);
    for (const a of this.anyListeners) a(type, msg);
  }

  private handleChooseTile(msg: ChooseTileMsg | undefined): void {
    if (!msg) return;
    let path: Side[] = [];
    if (Array.isArray(msg.sides) && msg.sides.length > 0) {
      const filtered = msg.sides.filter((s): s is Side => s === "left" || s === "right");
      if (filtered.length !== msg.sides.length) return;
      path = filtered;
    } else if (msg.side === "left" || msg.side === "right") {
      path = [msg.side];
    }
    if (path.length === 0) return;

    const result = resolveChoice(this.self, path, this.branches, Date.now());
    if (result.trailMark) {
      this.state.trails.push(result.trailMark);
      while (this.state.trails.length > soloBalance.maxTrailMarks) {
        this.state.trails.shift();
      }
    }

    this.emit("resolution", {
      id: this.sessionId,
      ...result,
      ...(result.success ? { successPath: path } : {})
    });
  }

  private handleRequestHint(): void {
    const now = Date.now();
    if (now - this.self.lastHintAt < soloBalance.hintCooldownMs) {
      this.emit("hintRejected", {
        nextAt: this.self.lastHintAt + soloBalance.hintCooldownMs
      });
      return;
    }
    this.self.lastHintAt = now;
    const branch = this.branches.getBranch(this.self.floor);
    const hint: SoloHint = {
      floor: this.self.floor,
      safeSide: branch.leftSafe ? "left" : "right",
      expiresAt: now + soloBalance.hintRevealMs
    };
    this.state.hints.set(this.sessionId, hint);
    this.emit("hintGranted", {
      floor: hint.floor,
      safeSide: hint.safeSide,
      expiresAt: hint.expiresAt,
      nickname: this.self.name
    });
    setTimeout(() => {
      const cur = (this.state.hints as unknown as { map?: Map<string, SoloHint> }).map?.get?.(
        this.sessionId
      );
      if (cur && cur.expiresAt === hint.expiresAt) {
        this.state.hints.delete(this.sessionId);
      }
    }, soloBalance.hintRevealMs + 16);
  }
}
