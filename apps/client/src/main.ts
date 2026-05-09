import { Application } from "pixi.js";
import { ensureAudio, playThemeSting } from "./audio/themePad";
import { THEME_EVERY_FLOORS } from "./config/climbConfig";
import { collectActiveHints } from "./hint/collectHints";
import { LevelBranchGenerator } from "./logic/levelBranch";
import { buildPickTargets } from "./logic/pickPath";
import { trapRevealKeyClient, readTrapKeys } from "./logic/trapKeys";
import { GameNetwork, type GameRoomLike, type ResolutionEvent } from "./net/colyseus";
import { ClimbStage, type ClimbHudModel, type GhostPlayerMini } from "./render/ClimbStage";
import { parseSide } from "./render/towerLayout";
import { applyWorldTheme } from "./theme/applyWorldTheme";
import { LeaderboardPanel, type BoardRow } from "./ui/leaderboardPanel";
import { openNicknameGate } from "./ui/loginGate";

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

function attachHintButton(net: GameNetwork, room: GameRoomLike): void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:12px;bottom:12px;z-index:50;display:flex;gap:8px";
  const b = document.createElement("button");
  b.textContent = "힌트 (10s 쿨)";
  b.style.cssText =
    "padding:11px 16px;font-size:13px;font-weight:600;border-radius:11px;border:1px solid rgba(255,255,255,.2);cursor:pointer;color:#eaf3ff;background:rgba(22,38,94,0.6)";
  b.onclick = () => {
    net.requestHint();
    ensureAudio();
  };
  const tip = document.createElement("div");
  tip.textContent =
    "다음 줄 정답 유리 패널이 1초간 밝게 표시되며 다른 플레이어에게도 노출됩니다.";
  tip.style.cssText =
    "align-self:center;max-width:220px;font-size:11px;opacity:.7;line-height:1.35;color:#dbe6ff;";
  bar.append(b, tip);
  document.body.appendChild(bar);

  room.onMessage("hintRejected", (raw: unknown) => {
    const msg = (raw ?? {}) as { nextAt?: number };
    const wait = typeof msg?.nextAt === "number" ? Math.max(0, msg.nextAt - Date.now()) : 0;
    b.textContent = wait > 0 ? `대기 ${(wait / 1000).toFixed(1)}s` : "힌트 (10s 쿨)";
    window.setTimeout(() => {
      b.textContent = "힌트 (10s 쿨)";
    }, Math.min(wait, 5500));
  });
}

async function startSession(nickname: string, mode: "multi" | "solo" = "multi"): Promise<void> {
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
  const leaderboard = new LeaderboardPanel(document.body);
  const net = new GameNetwork();

  let model = defaultModel();
  let lastThemeZone = -1;

  function layout(): void {
    climb.layout(window.innerWidth, window.innerHeight);
  }
  layout();
  window.addEventListener("resize", layout);

  climb.onPick((path) => {
    ensureAudio();
    net.chooseTilePath(path);
  });

  const room: GameRoomLike =
    mode === "solo" ? net.connectSolo(nickname) : await net.connect(nickname);
  if (mode === "solo") attachSoloBadge();

  attachHintButton(net, room);

  room.onMessage("resolution", (raw: unknown) => {
    const msg = raw as ResolutionEvent;
    if (
      msg.id !== room.sessionId &&
      !msg.success &&
      !msg.blockedDuplicate &&
      msg.toFloor === 1
    ) {
      const side = parseSide(msg.trailMark?.side ?? "left");
      climb.handleRemoteFall(msg.id, msg.fromFloor, side);
    }
    if (msg.id === room.sessionId && !msg.success && !msg.blockedDuplicate && msg.toFloor === 1) {
      climb.triggerLocalGlassBreak(msg.fromFloor, parseSide(msg.trailMark?.side ?? "left"));
    }
    if (msg.id !== room.sessionId) return;
    if (msg.success || msg.blockedDuplicate || msg.respawnLocked) return;
    leaderboard.flashFailSync({
      gainedEnergy: msg.gainedEnergy,
      jump: msg.syncedJumpPower,
      speed: msg.syncedMoveSpeed,
      energy: msg.syncedEnergy,
      runPeakConsumed: msg.runPeakConsumed
    });
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
    }

    const nowMs = Date.now();
    const respawnLockedServer = !!(model.respawnAvailableAt && nowMs < model.respawnAvailableAt);

    const pickTargets =
      !model.hasWon && !respawnLockedServer
        ? buildPickTargets(branchPreview, model.floor, model.jumpPower, trapKnown)
        : [];

    climb.setHud(model, {
      leftEnabled: pickTargets.length > 0,
      rightEnabled: pickTargets.length > 0
    });

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

    // 깨진 유리 회색 처리: 다른 플레이어 추락(trails)은 반영하지 않음. 내가 함정 패널을 밟았을 때만(revealedTrapKeys).
    const brokenKeys = new Set<string>();
    trapKnown.forEach((k) => brokenKeys.add(k));

    const activeHints = collectActiveHints(room.state as never, nameBySid);

    climb.syncWorld({
      screenW: typeof window !== "undefined" ? window.innerWidth : 960,
      screenH: typeof window !== "undefined" ? window.innerHeight : 540,
      selfId: room.sessionId,
      selfBestReached: model.bestFloorReached,
      selfFloor: model.floor,
      selfSide,
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
    leaderboard.render(rows, room.sessionId);

    const zone = Math.floor(model.floor / THEME_EVERY_FLOORS);
    if (zone !== lastThemeZone) {
      lastThemeZone = zone;
      applyWorldTheme(model.floor);
      playThemeSting(zone);
    }
  });
}

function attachSoloBadge(): void {
  const tag = document.createElement("div");
  tag.textContent = "단독 플레이 모드 (서버 미연결)";
  tag.style.cssText =
    "position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:60;padding:6px 12px;font-size:12px;font-weight:600;color:#ffe6c4;border:1px solid rgba(255,200,140,0.4);background:rgba(60,30,8,0.55);border-radius:999px;letter-spacing:.3px";
  document.body.appendChild(tag);
}

openNicknameGate({
  overlayParent: document.body,
  introTitle: "유리 다리 · 접속 대기실",
  onJoin: async (nickname) => {
    await startSession(nickname);
  },
  onSolo: async (nickname) => {
    await startSession(nickname, "solo");
  }
});
