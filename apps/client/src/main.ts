import { Application } from "pixi.js";
import { ensureAudio, playThemeSting } from "./audio/themePad";
import { mountReactHud } from "./bootstrap";
import { THEME_EVERY_FLOORS } from "./config/climbConfig";
import { collectActiveHints } from "./hint/collectHints";
import { htmlLang, type Locale } from "./i18n";
import { LevelBranchGenerator } from "./logic/levelBranch";
import { buildPickTargets } from "./logic/pickPath";
import { trapRevealKeyClient, readTrapKeys } from "./logic/trapKeys";
import { GameNetwork, type GameRoomLike, type ResolutionEvent } from "./net/colyseus";
import { ClimbStage, type ClimbHudModel, type GhostPlayerMini } from "./render/ClimbStage";
import { parseSide } from "./render/towerLayout";
import { useHudStore } from "./state/hudStore";
import { applyWorldTheme } from "./theme/applyWorldTheme";
import type { BoardRow } from "./ui/react/Leaderboard/boardTypes";

/** 서버와 동일 XOR — 반짝/히트 타일 미리 계산용 */
const branchPreview = new LevelBranchGenerator();

function defaultModel(): ClimbHudModel {
  return {
    floor: 1,
    runPeakFloor: 1,
    bestFloorReached: 1,
    failEnergy: 0,
    jumpPower: 1,
    moveSpeed: 4,
    auraTier: "blue",
    hasWon: false,
    respawnAvailableAt: 0
  };
}

function visualTrapKeyFromServerKey(k: string): string | null {
  const [floorRaw, sideRaw] = k.split("|");
  const floor = Number(floorRaw);
  if (!Number.isFinite(floor) || (sideRaw !== "left" && sideRaw !== "right")) return null;
  return trapRevealKeyClient(floor + 1, sideRaw);
}

function bindHintActions(net: GameNetwork, room: GameRoomLike): void {
  const store = useHudStore.getState();
  store.setOnRequestHint(() => {
    net.requestHint();
  });
  room.onMessage("hintRejected", (raw: unknown) => {
    const msg = (raw ?? {}) as { nextAt?: number };
    const nextAt = typeof msg?.nextAt === "number" ? msg.nextAt : 0;
    useHudStore.getState().setHintCooldownUntil(nextAt);
  });
}

async function startSession(
  nickname: string,
  locale: Locale,
  mode: "multi" | "solo" = "multi"
): Promise<void> {
  document.documentElement.lang = htmlLang(locale);
  const appEl = document.getElementById("app");
  if (!appEl) throw new Error("Missing #app root");

  const pixi = new Application();
  await pixi.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true
  });
  appEl.appendChild(pixi.canvas);

  const climb = new ClimbStage(pixi);
  const net = new GameNetwork();

  let model = defaultModel();
  let lastThemeZone = -1;

  function layout(): void {
    climb.layout(window.innerWidth, window.innerHeight);
  }
  layout();
  window.addEventListener("resize", layout);

  let pendingPickPath: ("left" | "right")[] | null = null;
  let lastMultiMatchPhase: "waiting" | "playing" | "ended" = "waiting";

  climb.onPick((path) => {
    ensureAudio();
    pendingPickPath = path;
    net.chooseTilePath(path);
  });

  const room: GameRoomLike =
    mode === "solo" ? net.connectSolo(nickname) : await net.connect(nickname);
  useHudStore.getState().setMode(mode);
  useHudStore.getState().clearRecentTileChoices();

  bindHintActions(net, room);

  room.onMessage("resolution", (raw: unknown) => {
    const msg = raw as ResolutionEvent;
    if (msg.id === room.sessionId) {
      if (
        pendingPickPath &&
        !msg.blockedDuplicate &&
        !msg.respawnLocked &&
        useHudStore.getState().showRecentTileStrip
      ) {
        useHudStore.getState().pushRecentTileChoices(pendingPickPath);
      }
      pendingPickPath = null;
    }
    if (
      msg.id !== room.sessionId &&
      !msg.success &&
      !msg.blockedDuplicate &&
      msg.toFloor === 1
    ) {
      const side = parseSide(msg.trailMark?.side ?? "left");
      climb.handleRemoteFall(msg.id, msg.fromFloor + 1, side);
    }
    if (msg.id === room.sessionId && !msg.success && !msg.blockedDuplicate && msg.toFloor === 1) {
      climb.triggerLocalGlassBreak(msg.fromFloor + 1, parseSide(msg.trailMark?.side ?? "left"));
    }
  });

  function pullFromPlayer(p: Record<string, unknown>): void {
    model = {
      floor: Number(p.floor ?? 1),
      runPeakFloor: Number(p.runPeakFloor ?? 1),
      bestFloorReached: Number(p.bestFloorReached ?? 1),
      failEnergy: Number(p.failEnergy ?? 0),
      jumpPower: Number(p.jumpPower ?? 1),
      moveSpeed: Number(p.moveSpeed ?? 4),
      auraTier: String(p.auraTier ?? "blue"),
      hasWon: Boolean(p.hasWon),
      respawnAvailableAt:
        typeof p.respawnAvailableAt === "number" ? p.respawnAvailableAt : Number(p.respawnAvailableAt ?? 0)
    };
  }

  applyWorldTheme(1);

  pixi.canvas.addEventListener(
    "pointerdown",
    () => {
      ensureAudio();
    },
    { once: true }
  );

  const stateAny = (): {
    players?: { forEach: (cb: (p: unknown, id: string) => void) => void };
    hints?: { forEach: (cb: (h: unknown, id: string) => void) => void };
  } => (room.state as never) ?? {};

  pixi.ticker.add(() => {
    let self: unknown = null;
    stateAny().players?.forEach((p: unknown, id: string) => {
      if (id === room.sessionId) self = p;
    });

    const nameBySid = new Map<string, string>();
    stateAny().players?.forEach((pRecord: unknown, id: string) => {
      const r = (pRecord as Record<string, unknown>) ?? {};
      nameBySid.set(id, String(r.name ?? id.slice(0, 4)));
    });

    let trapKnown = new Set<string>();
    let selfSide = parseSide("left");
    if (self) {
      const p = self as Record<string, unknown>;
      pullFromPlayer(p);
      trapKnown = readTrapKeys(p.revealedTrapKeys);
      selfSide = parseSide(p.currentSide);
      useHudStore.getState().setShowRecentTileStrip(Boolean(p.showRecentTileStrip));
    }

    const nowMs = Date.now();
    const respawnLockedServer = !!(model.respawnAvailableAt && nowMs < model.respawnAvailableAt);

    const stateRecord = room.state as Record<string, unknown>;
    const rawPhase = stateRecord.matchPhase;
    const matchPhase =
      rawPhase === "ended" ? "ended" : rawPhase === "playing" ? "playing" : "waiting";
    const roundActive = mode !== "multi" || matchPhase === "playing";
    if (mode === "multi") {
      useHudStore.getState().setMultiMatchPhase(matchPhase);
      if (matchPhase === "playing" && lastMultiMatchPhase !== "playing") {
        useHudStore.getState().clearRecentTileChoices();
      }
      lastMultiMatchPhase = matchPhase;
    }

    const pickTargets =
      roundActive && !model.hasWon && !respawnLockedServer
        ? buildPickTargets(branchPreview, model.floor, model.jumpPower, trapKnown)
        : [];

    climb.setHud(model, {
      leftEnabled: pickTargets.length > 0,
      rightEnabled: pickTargets.length > 0
    });
    useHudStore.getState().setModel(model);

    /** 글로우는 "착지 발판"(t.floor + 1)에 표시 — 사용자가 보고 누를 발판이 빛남 */
    const pickGlowKeys = pickTargets.map((t) => trapRevealKeyClient(t.floor + 1, t.side));

    const ghosts: GhostPlayerMini[] = [];
    stateAny().players?.forEach((p: unknown, id: string) => {
      const pPlayer = (p as Record<string, unknown>) ?? {};
      ghosts.push({
        id,
        name: String(pPlayer.name ?? id.slice(0, 4)),
        floor: typeof pPlayer.floor === "number" ? (pPlayer.floor as number) : Number(pPlayer.floor ?? 1),
        side: parseSide(pPlayer.currentSide)
      });
    });

    // 서버 trap key는 "선택 구간 층"이고, 화면에서는 그 결과로 밟는 다음 발판(+1)이 깨져 보인다.
    const brokenKeys = new Set<string>();
    trapKnown.forEach((k) => {
      const visualKey = visualTrapKeyFromServerKey(k);
      if (visualKey) brokenKeys.add(visualKey);
    });

    const activeHints = collectActiveHints(room.state as never, nameBySid);

    climb.syncWorld({
      screenW: typeof window !== "undefined" ? window.innerWidth : 960,
      screenH: typeof window !== "undefined" ? window.innerHeight : 540,
      selfId: room.sessionId,
      selfBestReached: model.bestFloorReached,
      selfFloor: model.floor,
      selfSide,
      jumpPower: model.jumpPower,
      ghosts,
      brokenKeys: [...brokenKeys],
      pickGlowKeys,
      pickTargets,
      hasWon: model.hasWon,
      activeHints
    });

    const rows: BoardRow[] = [];
    stateAny().players?.forEach((raw: unknown, id: string) => {
      const p = (raw as Record<string, unknown>) ?? {};
      rows.push({
        id,
        name: String(p.name ?? id.slice(0, 4)),
        bestFloor:
          typeof p.bestFloorReached === "number"
            ? p.bestFloorReached
            : Number(p.bestFloorReached ?? 1),
        failEnergy: typeof p.failEnergy === "number" ? p.failEnergy : Number(p.failEnergy ?? 0)
      });
    });
    useHudStore.getState().setLeaderRows(rows, room.sessionId);

    const zone = Math.floor(model.floor / THEME_EVERY_FLOORS);
    if (zone !== lastThemeZone) {
      lastThemeZone = zone;
      applyWorldTheme(model.floor);
      playThemeSting(zone);
    }
  });
}

mountReactHud({
  onJoin: async (nickname, locale) => {
    useHudStore.getState().setLocale(locale);
    await startSession(nickname, locale);
  },
  onSolo: async (nickname, locale) => {
    useHudStore.getState().setLocale(locale);
    await startSession(nickname, locale, "solo");
  },
  onAdminSession: async (password, locale) => {
    useHudStore.getState().setLocale(locale);
    document.documentElement.lang = htmlLang(locale);
    const net = new GameNetwork();
    const room = await net.connectAdmin(password);
    useHudStore.getState().setAdminRoom(room);
    useHudStore.getState().setMode("admin");
  }
});
