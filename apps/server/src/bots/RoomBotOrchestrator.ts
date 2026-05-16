import { Client } from "colyseus.js";
import { botServerUrl, buildBotRowsForCount, loadBotFillConfig } from "./botConfig.js";
import { BotRunner, wireResolution } from "./BotRunner.js";

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
  private fillGeneration = 0;

  async fill(params: FillBotsParams): Promise<void> {
    const cfg = loadBotFillConfig();
    if (!cfg.enabled) return;

    const gen = ++this.fillGeneration;
    await this.release();

    const deficit = params.maxClients - params.connectedCount;
    if (deficit <= 0) {
      console.log(`[bot-fill] room ${params.roomId}: already full (${params.connectedCount}/${params.maxClients})`);
      return;
    }

    const rows = buildBotRowsForCount(deficit, cfg.groups);
    const url = botServerUrl();
    const botBySession = new Map<string, BotRunner>();
    const joined: BotRunner[] = [];

    console.log(
      `[bot-fill] room ${params.roomId}: joining ${rows.length} bots (${params.connectedCount} → ${params.connectedCount + rows.length}) via ${url}`
    );

    try {
      for (let i = 0; i < rows.length; i++) {
        if (gen !== this.fillGeneration) return;
        if (cfg.joinStaggerMs > 0 && i > 0) await sleep(cfg.joinStaggerMs);

        const row = rows[i]!;
        const cl = new Client(url);
        const room = await cl.joinById(params.roomId, { name: row.displayName });
        const bot = new BotRunner(room, row.displayName, row.groupId, row.spec);
        joined.push(bot);
        botBySession.set(bot.sessionId, bot);
      }
    } catch (e) {
      console.warn("[bot-fill] join failed, rolling back partial bots", e);
      await Promise.all(joined.map((b) => b.room.leave().catch(() => 0)));
      throw e;
    }

    if (gen !== this.fillGeneration) {
      await Promise.all(joined.map((b) => b.room.leave().catch(() => 0)));
      return;
    }

    if (joined.length > 0) {
      wireResolution(joined[0]!.room, botBySession);
    }

    this.bots = joined;
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      for (const b of this.bots) b.tick(now);
    }, cfg.tickMs);
  }

  async release(): Promise<void> {
    this.fillGeneration++;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    const leaving = this.bots;
    this.bots = [];
    if (leaving.length === 0) return;
    console.log(`[bot-fill] releasing ${leaving.length} bots`);
    await Promise.all(leaving.map((b) => b.room.leave().catch(() => 0)));
  }
}
