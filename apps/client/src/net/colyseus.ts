import { Client, Room } from "colyseus.js";
import { LocalRoom } from "../sim/LocalRoom";

/** main.ts 가 실제 Room 과 LocalRoom 양쪽 모두에서 쓸 수 있는 최소 표면 */
export type GameRoomLike = Pick<Room, "sessionId"> & {
  state: unknown;
  onMessage: (type: string, cb: (msg: unknown) => void) => void;
  send: (type: string, payload?: unknown) => void;
  leave?: () => Promise<number> | number | void;
};

export interface ResolutionEvent {
  id: string;
  success: boolean;
  fromFloor: number;
  toFloor: number;
  blockedDuplicate?: boolean;
  blockedWall?: boolean;
  gainedEnergy?: number;
  syncedJumpPower?: number;
  syncedMoveSpeed?: number;
  syncedEnergy?: number;
  runPeakConsumed?: number;
  trailMark?: { floor: number; side: string };
  respawnLocked?: boolean;
}

export interface HintGrantedEvent {
  floor: number;
  safeSide: "left" | "right";
  expiresAt: number;
  nickname?: string;
}

export class GameNetwork {
  private readonly client = new Client(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
  room?: GameRoomLike;

  async connect(name: string): Promise<GameRoomLike> {
    const real = await this.client.joinOrCreate("failure-growth", { name });
    this.room = real as unknown as GameRoomLike;
    return this.room;
  }

  /** 서버 없이 단독 플레이 — 로컬에서 GameRoom 로직을 흉내. */
  connectSolo(name: string): GameRoomLike {
    const local = new LocalRoom(name);
    this.room = local as unknown as GameRoomLike;
    return this.room;
  }

  chooseTilePath(sides: ("left" | "right")[]): void {
    if (!sides.length) return;
    this.room?.send("chooseTile", { sides });
  }

  requestHint(): void {
    this.room?.send("requestHint");
  }
}
