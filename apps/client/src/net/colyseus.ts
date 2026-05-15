import { Client, Room } from "colyseus.js";
import { LocalRoom } from "../sim/LocalRoom";

/** main.ts 가 실제 Room 과 LocalRoom 양쪽 모두에서 쓸 수 있는 최소 표면 */
export type GameRoomLike = Pick<Room, "sessionId"> & {
  state: unknown;
  onMessage: (type: string, cb: (msg: unknown) => void) => void;
  send: (type: string, payload?: unknown) => void;
  leave?: (code?: number) => Promise<number | void> | number | void;
  /** Colyseus Room 전용 — 솔로 로컬 룸에는 없을 수 있음 */
  onStateChange?: (cb: () => void) => void;
};

export interface ResolutionEvent {
  id: string;
  success: boolean;
  fromFloor: number;
  toFloor: number;
  /** 성공 시 서버가 보내는 경로(층별 L/R). 멀티 스텝일 때 관측용. */
  successPath?: ("left" | "right")[];
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

  /** 관리자 UI — 입장 옵션의 비밀번호는 서버 `config/admin-config.json`과 일치해야 합니다. */
  async connectAdmin(password: string): Promise<GameRoomLike> {
    const real = await this.client.joinOrCreate("failure-growth", { adminPassword: password });
    const room = real as unknown as GameRoomLike & { leave: (code?: number) => Promise<void> };

    return await new Promise<GameRoomLike>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        void room.leave(4408).catch(() => {});
        reject(new Error("admin auth timeout"));
      }, 8000);

      const onFail = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        void room.leave(4401).catch(() => {});
        reject(new Error("admin auth failed"));
      };

      const onPong = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.room = room;
        resolve(room);
      };

      room.onMessage("adminAuthFailed", onFail);
      room.onMessage("adminPong", onPong);
      room.send("adminPing");
    });
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
