/**
 * Colyseus 봇 부하 테스트 — 실제 플레이와 유사하게 chooseTile / requestHint 전송.
 *
 * 사용법 (프로젝트 루트):
 *   npm run dev
 *   다른 터미널에서: npm run loadtest
 *
 * 옵션:
 *   --url <ws(s)://host:port>     기본 ws://localhost:2567
 *   --clients <n>                 동시 봇 수 (최대 100, GameRoom.maxClients)
 *   --seconds <n>                 테스트 지속 시간(초), 기본 60
 *   --min-ms / --max-ms           봇별 chooseTile 간격(ms), 기본 300~1500
 *   --hint-p <0~1>                매 턴에 requestHint를 보낼 확률, 기본 0.02
 */
import { Client, type Room } from "colyseus.js";

const ROOM_NAME = "failure-growth";
/** GameRoom.maxClients 과 맞춤 */
const MAX_ROOM_CLIENTS = 100;

type Opts = {
  url: string;
  clients: number;
  durationMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  hintP: number;
  joinStaggerMs: number;
};

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const o: Opts = {
    url: "ws://localhost:2567",
    clients: 30,
    durationMs: 60_000,
    minIntervalMs: 300,
    maxIntervalMs: 1500,
    hintP: 0.02,
    joinStaggerMs: 50
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case "--url":
        o.url = next();
        break;
      case "--clients":
        o.clients = Number(next());
        break;
      case "--seconds":
        o.durationMs = Number(next()) * 1000;
        break;
      case "--min-ms":
        o.minIntervalMs = Number(next());
        break;
      case "--max-ms":
        o.maxIntervalMs = Number(next());
        break;
      case "--hint-p":
        o.hintP = Number(next());
        break;
      case "--join-stagger-ms":
        o.joinStaggerMs = Number(next());
        break;
      case "--help":
      case "-h":
        console.log(`See header comment in apps/loadtest/src/run.ts`);
        process.exit(0);
      default:
        if (a.startsWith("-")) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
    }
  }

  if (!Number.isFinite(o.clients) || o.clients < 1) {
    console.error("--clients must be >= 1");
    process.exit(1);
  }
  if (o.clients > MAX_ROOM_CLIENTS) {
    console.warn(`--clients ${o.clients} capped to ${MAX_ROOM_CLIENTS} (GameRoom.maxClients)`);
    o.clients = MAX_ROOM_CLIENTS;
  }
  if (o.maxIntervalMs < o.minIntervalMs) {
    [o.minIntervalMs, o.maxIntervalMs] = [o.maxIntervalMs, o.minIntervalMs];
  }
  return o;
}

function rndSide(): "left" | "right" {
  return Math.random() < 0.5 ? "left" : "right";
}

function sendChoose(room: Room): void {
  // 일부는 짧은 경로, 일부는 단일 사이드 — 서버 chooseTile 경로와 동일
  if (Math.random() < 0.35) {
    const len = 1 + Math.floor(Math.random() * 3);
    const sides = Array.from({ length: len }, () => rndSide());
    room.send("chooseTile", { sides });
  } else {
    room.send("chooseTile", { side: rndSide() });
  }
}

function silenceBroadcastWarnings(room: Room): void {
  room.onMessage("*", () => {
    /* resolution, hintGranted 등 — 부하만 보면 됨 */
  });
}

function startBotLoop(
  room: Room,
  endAt: number,
  opts: Opts
): void {
  const step = (): void => {
    if (Date.now() >= endAt) return;
    const delay =
      opts.minIntervalMs +
      Math.random() * (opts.maxIntervalMs - opts.minIntervalMs);
    setTimeout(() => {
      if (Date.now() >= endAt) return;
      try {
        sendChoose(room);
        if (Math.random() < opts.hintP) {
          room.send("requestHint");
        }
      } catch {
        /* room may be closing */
      }
      step();
    }, delay);
  };
  step();
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log(
    `[loadtest] url=${opts.url} clients=${opts.clients} duration=${opts.durationMs / 1000}s interval=${opts.minIntervalMs}-${opts.maxIntervalMs}ms`
  );

  const endAt = Date.now() + opts.durationMs;
  const leadClient = new Client(opts.url);
  const leadRoom = await leadClient.joinOrCreate(ROOM_NAME, {
    name: "loadtest-lead"
  });
  silenceBroadcastWarnings(leadRoom);
  const roomId = leadRoom.roomId;
  const rooms: Room[] = [leadRoom];

  for (let i = 1; i < opts.clients; i++) {
    if (opts.joinStaggerMs > 0) {
      await new Promise((r) => setTimeout(r, opts.joinStaggerMs));
    }
    const c = new Client(opts.url);
    const r = await c.joinById(roomId, { name: `load-${i}` });
    silenceBroadcastWarnings(r);
    rooms.push(r);
  }

  console.log(`[loadtest] joined room ${roomId} with ${rooms.length} clients`);

  for (const r of rooms) {
    startBotLoop(r, endAt, opts);
  }

  await new Promise<void>((resolve) =>
    setTimeout(resolve, opts.durationMs)
  );

  await Promise.all(
    rooms.map((r) => r.leave().catch(() => 0))
  );
  console.log("[loadtest] done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
