import { create } from "zustand";
import { getStoredLocale, type Locale } from "../i18n";
import type { GameRoomLike } from "../net/colyseus";
import type { ClimbHudModel } from "../render/ClimbStage";
import type { BoardRow } from "../ui/react/Leaderboard/boardTypes";

export type AppMode = "gate" | "loading" | "solo" | "multi" | "admin";

export type MultiMatchPhase = "waiting" | "playing" | "ended";

function modelsEqual(a: ClimbHudModel, b: ClimbHudModel): boolean {
  return (
    a.floor === b.floor &&
    a.runPeakFloor === b.runPeakFloor &&
    a.bestFloorReached === b.bestFloorReached &&
    a.failEnergy === b.failEnergy &&
    a.jumpPower === b.jumpPower &&
    a.moveSpeed === b.moveSpeed &&
    a.auraTier === b.auraTier &&
    a.hasWon === b.hasWon &&
    a.respawnAvailableAt === b.respawnAvailableAt
  );
}

function rowsEqual(a: BoardRow[], b: BoardRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.bestFloor !== y.bestFloor ||
      x.failEnergy !== y.failEnergy
    ) {
      return false;
    }
  }
  return true;
}

export interface HudState {
  locale: Locale;
  mode: AppMode;
  /** 캐릭터/등반 HUD 상태. gate 단계에서는 기본값 */
  model: ClimbHudModel;
  leaderRows: BoardRow[];
  selfSessionId: string;
  /** 힌트 쿨다운 만료 (unix ms). 0이면 사용 가능 */
  hintCooldownUntil: number;
  /** session 시작 시 main.ts 가 주입하는 액션 핸들러 */
  onRequestHint: () => void;
  /** 관리자 패널에서 사용하는 Colyseus 룸 (멀티 전용) */
  adminRoom: GameRoomLike | null;
  /** 멀티 서버 `matchPhase` 미러 (대기 배너용) */
  multiMatchPhase: MultiMatchPhase;

  setLocale: (locale: Locale) => void;
  setMode: (mode: AppMode) => void;
  setModel: (model: ClimbHudModel) => void;
  setLeaderRows: (rows: BoardRow[], selfId: string) => void;
  setHintCooldownUntil: (atMs: number) => void;
  setOnRequestHint: (fn: () => void) => void;
  setAdminRoom: (room: GameRoomLike | null) => void;
  setMultiMatchPhase: (phase: MultiMatchPhase) => void;
  reset: () => void;
}

const defaultModel = (): ClimbHudModel => ({
  floor: 1,
  runPeakFloor: 1,
  bestFloorReached: 1,
  failEnergy: 0,
  jumpPower: 1,
  moveSpeed: 4,
  auraTier: "blue",
  hasWon: false,
  respawnAvailableAt: 0
});

export const useHudStore = create<HudState>((set, get) => ({
  locale: getStoredLocale(),
  mode: "gate",
  model: defaultModel(),
  leaderRows: [],
  selfSessionId: "",
  hintCooldownUntil: 0,
  onRequestHint: () => {},
  adminRoom: null,
  multiMatchPhase: "waiting",

  setLocale: (locale) => set({ locale }),
  setMode: (mode) => {
    if (get().mode === mode) return;
    set({ mode });
  },
  /** ticker가 매 프레임 호출하므로 동등 비교로 리렌더 차단 */
  setModel: (model) => {
    if (modelsEqual(get().model, model)) return;
    set({ model });
  },
  setLeaderRows: (leaderRows, selfSessionId) => {
    const cur = get();
    if (cur.selfSessionId === selfSessionId && rowsEqual(cur.leaderRows, leaderRows)) return;
    set({ leaderRows, selfSessionId });
  },
  setHintCooldownUntil: (hintCooldownUntil) => {
    if (get().hintCooldownUntil === hintCooldownUntil) return;
    set({ hintCooldownUntil });
  },
  setOnRequestHint: (onRequestHint) => set({ onRequestHint }),
  setAdminRoom: (adminRoom) => set({ adminRoom }),
  setMultiMatchPhase: (multiMatchPhase) => {
    if (get().multiMatchPhase === multiMatchPhase) return;
    set({ multiMatchPhase });
  },
  reset: () =>
    set({
      mode: "gate",
      model: defaultModel(),
      leaderRows: [],
      selfSessionId: "",
      hintCooldownUntil: 0,
      adminRoom: null,
      multiMatchPhase: "waiting"
    })
}));
