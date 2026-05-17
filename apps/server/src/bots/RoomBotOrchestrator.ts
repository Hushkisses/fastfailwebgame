import { Client } from "colyseus.js";
import { botServerUrl, buildBotRowsForCount, loadBotFillConfig } from "./botConfig.js";
import { BotRunner } from "./BotRunner.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface FillBotsParams {
  roomId: string;
  maxClients: number;
  connectedCount: number;
}

/** 관리자 라운드 시작 시 Colyseus 클라이언트 봇으로 방을 가득 채웁니다. */
export class RoomBotOrchestrator {
  private bots: BotRunner[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  /** fill 취소용 — `release()`만 증가시킵니다. */
  private fillGeneration = 0;

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** 접속 끊기만 (generation 변경 없음) */
  private async disconnectAll(): Promise<void> {
    this.stopTick();
    const leaving = this.bots;
    this.bots = [];
    if (leaving.length === 0) return;
    console.log(`[bot-fill] disconnecting ${leaving.length} bots`);
    await Promise.all(leaving.map((b) => b.room.leave().catch(() => 0)));
  }

  async fill(params: FillBotsParams): Promise<void> {
    const cfg = loadBotFillConfig();
    if (!cfg.enabled) {
      console.log("[bot-fill] disabled in config (bot-fill.json enabled:false)");
      return;
    }

    const gen = ++this.fillGeneration;
    await this.disconnectAll();

    const deficit = params.maxClients - params.connectedCount;
    if (deficit <= 0) {
      console.log(`[bot-fill] room ${params.roomId}: already full (${params.connectedCount}/${params.maxClients})`);
      return;
    }

    const rows = buildBotRowsForCount(deficit, cfg.groups);
    const url = botServerUrl();
    const joined: BotRunner[] = [];

    console.log(
      `[bot-fill] room ${params.roomId}: joining ${rows.length} bots (${params.connectedCount} → ${params.connectedCount + rows.length}) via ${url}`
    );

    const concurrency = Math.min(12, Math.max(1, Number(process.env.BOT_FILL_CONCURRENCY ?? 8)));

    try {
      let nextIndex = 0;
      const worker = async (): Promise<void> => {
        for (;;) {
          if (gen !== this.fillGeneration) return;
          const i = nextIndex++;
          if (i >= rows.length) return;

          if (cfg.joinStaggerMs > 0 && i > 0) await sleep(cfg.joinStaggerMs);

          const row = rows[i]!;
          const cl = new Client(url);
          const room = await cl.joinById(params.roomId, { name: row.displayName });
          if (gen !== this.fillGeneration) {
            await room.leave().catch(() => 0);
            return;
          }
          const bot = new BotRunner(room, row.displayName, row.groupId, row.spec);
          joined.push(bot);
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    } catch (e) {
      console.warn("[bot-fill] join failed, rolling back partial bots", e);
      await Promise.all(joined.map((b) => b.room.leave().catch(() => 0)));
      throw e;
    }

    if (gen !== this.fillGeneration) {
      await Promise.all(joined.map((b) => b.room.leave().catch(() => 0)));
      return;
    }

    this.bots = joined;
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      for (const b of this.bots) b.tick(now);
    }, cfg.tickMs);

    console.log(`[bot-fill] room ${params.roomId}: ${joined.length} bots active`);
  }

  async release(): Promise<void> {
    this.fillGeneration++;
    await this.disconnectAll();
  }
}
