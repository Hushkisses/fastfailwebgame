import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type Room } from "colyseus.js";
import {
  type Side,
  expandBotRows,
  loadOnlineSimConfig,
  parseGroupFromDisplayName,
  type OnlineSimConfig,
  type StrategySpec
} from "./config.js";
import { type GameStateLike, pickRandomSide, type ResolutionPayload } from "./ledger.js";

const ROOM_NAME = "failure-growth";
const MAX_ROOM_CLIENTS = 100;

const __dirname = dirname(fileURLToPath(import.meta.url));

function oppositeSide(s: Side): Side {
  return s === "left" ? "right" : "left";
}

function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  const local = resolve(__dirname, "../online-sim-config.json");
  const example = resolve(__dirname, "../online-sim-config.example.json");
  let configPath = existsSync(local) ? local : example;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) {
      configPath = resolve(process.cwd(), args[++i]!);
    }
  }
  return { configPath };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Colyseus `onMessage` returns an unsubscribe function — register one-shot
 * handlers (same outcome as `room.once` for these message types).
 */
function waitAdminAuth(room: Room): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    let settled = false;
    let unsubPong: () => void = () => {};
    let unsubFail: () => void = () => {};

    const dispose = (): void => {
      unsubPong();
      unsubFail();
    };

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      dispose();
      rejectFn(new Error("admin auth timeout"));
    }, 12_000);

    unsubPong = room.onMessage("adminPong", () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      dispose();
      resolveFn();
    });
    unsubFail = room.onMessage("adminAuthFailed", () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      dispose();
      rejectFn(new Error("admin auth failed"));
    });

    room.send("adminPing");
  });
}

function csvEscape(s: string | number | boolean): string {
  const t = String(s);
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function wireResolution(room: Room, botBySession: Map<string, BotRunner>): void {
  room.onMessage("resolution", (msg: unknown) => {
    const m = msg as ResolutionPayload;
    if (m.blockedDuplicate && m.id) {
      botBySession.get(m.id)?.onBlockedDuplicate();
    }
  });
}

class BotRunner {
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
    this.queuedSide = this.lastSentSide !== null ? oppositeSide(this.lastSentSide) : pickRandomSide(Math.random);
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
      side = pickRandomSide(Math.random);
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

async function main(): Promise<void> {
  const { configPath } = parseArgs();
  const configAbs = resolve(configPath);
  const cfg = loadOnlineSimConfig(configAbs);
  const rows = expandBotRows(cfg);
  if (rows.length > MAX_ROOM_CLIENTS) {
    console.warn(`봇 수 ${rows.length} → ${MAX_ROOM_CLIENTS} 로 제한 (GameRoom.maxClients)`);
    rows.length = MAX_ROOM_CLIENTS;
  }

  const botBySession = new Map<string, BotRunner>();
  const bots: BotRunner[] = [];

  let roomId: string;
  let adminRoom: Room | null = null;

  if (cfg.adminPassword.length > 0) {
    const adminClient = new Client(cfg.url);
    adminRoom = await adminClient.joinOrCreate(ROOM_NAME, { adminPassword: cfg.adminPassword });
    await waitAdminAuth(adminRoom);
    roomId = adminRoom.roomId;
    console.log(`[online-sim] 관리자 입장 roomId=${roomId}`);
  } else {
    const c = new Client(cfg.url);
    const first = await c.joinOrCreate(ROOM_NAME, { name: rows[0]!.displayName });
    roomId = first.roomId;
    const br = new BotRunner(first, rows[0]!.displayName, rows[0]!.groupId, rows[0]!.spec);
    bots.push(br);
    botBySession.set(br.sessionId, br);
    wireResolution(bots[0]!.room, botBySession);
    console.log(`[online-sim] 첫 봇 생성 방 ${roomId} (adminPassword 없음 — 라운드는 관리자 UI에서 시작)`);

    for (let i = 1; i < rows.length; i++) {
      if (cfg.joinStaggerMs > 0) await sleep(cfg.joinStaggerMs);
      const cl = new Client(cfg.url);
      const room = await cl.joinById(roomId, { name: rows[i]!.displayName });
      const b = new BotRunner(room, rows[i]!.displayName, rows[i]!.groupId, rows[i]!.spec);
      bots.push(b);
      botBySession.set(b.sessionId, b);
    }

    const tick = setInterval(() => {
      const now = Date.now();
      for (const b of bots) b.tick(now);
    }, cfg.tickMs);

    await sleep(cfg.roundDurationMs);
    clearInterval(tick);
    await writeStats(cfg, configAbs, bots[0]!.room);
    await Promise.all(bots.map((b) => b.room.leave().catch(() => 0)));
    console.log("[online-sim] 종료 (비밀번호 없음 모드)");
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    if (cfg.joinStaggerMs > 0 && i > 0) await sleep(cfg.joinStaggerMs);
    const cl = new Client(cfg.url);
    const room = await cl.joinById(roomId, { name: rows[i]!.displayName });
    const b = new BotRunner(room, rows[i]!.displayName, rows[i]!.groupId, rows[i]!.spec);
    bots.push(b);
    botBySession.set(b.sessionId, b);
  }
  console.log(`[online-sim] 봇 ${bots.length}명 입장`);

  wireResolution(bots[0]!.room, botBySession);

  adminRoom!.send("adminStart");
  await sleep(400);

  const tick = setInterval(() => {
    const now = Date.now();
    for (const b of bots) b.tick(now);
  }, cfg.tickMs);

  await sleep(cfg.roundDurationMs);
  clearInterval(tick);

  adminRoom!.send("adminEnd");
  await sleep(600);

  await writeStats(cfg, configAbs, bots[0]!.room);

  await Promise.all(bots.map((b) => b.room.leave().catch(() => 0)));
  await adminRoom!.leave().catch(() => 0);
  console.log("[online-sim] 완료");
}

async function writeStats(cfg: OnlineSimConfig, configAbs: string, room: Room): Promise<void> {
  const outDir = resolve(dirname(configAbs), cfg.outputDir);
  mkdirSync(outDir, { recursive: true });
  const st = room.state as unknown as GameStateLike;
  const lines: string[] = [
    [
      "groupId",
      "botIndex",
      "name",
      "rank",
      "failCount",
      "bestFloorReached",
      "currentFloor",
      "failEnergy",
      "hasWon",
      "avgSelectionWaitSec",
      "showRecentTileStrip"
    ].join(",")
  ];
  const stats = st.lastRoundStats;
  if (!stats || typeof stats.length !== "number" || stats.length === 0) {
    writeFileSync(resolve(outDir, "round_stats.csv"), "no_stats\n", "utf8");
    console.warn("[online-sim] lastRoundStats 비어 있음 — 라운드가 끝나지 않았거나 아직 집계 없음");
    return;
  }
  const n = stats.length;
  for (let i = 0; i < n; i++) {
    const row = stats.at ? stats.at(i) : stats[i];
    if (!row) continue;
    const parsed = parseGroupFromDisplayName(row.name);
    const groupId = parsed?.groupId ?? "";
    const botIndex = parsed?.index ?? "";
    lines.push(
      [
        groupId,
        botIndex,
        row.name,
        row.rank,
        row.failCount,
        row.bestFloorReached,
        row.currentFloor,
        row.failEnergy,
        row.hasWon,
        row.avgSelectionWaitSec ?? 0,
        row.showRecentTileStrip ? 1 : 0
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  writeFileSync(resolve(outDir, "round_stats.csv"), lines.join("\n") + "\n", "utf8");
  console.log(`[online-sim] 통계 저장: ${resolve(outDir, "round_stats.csv")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
