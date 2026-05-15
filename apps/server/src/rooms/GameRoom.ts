import { Room, Client } from "colyseus";
import { gameBalance } from "../config/gameBalance.js";
import { loadAdminConfig } from "../adminConfig.js";
import { LevelBranchGenerator, type Side } from "../core/grid.js";
import { refreshPlayerStats, resolveChoice } from "../core/resolver.js";
import {
  GameState,
  HintResult,
  PlayerState,
  RoundStatEntry,
  TrailMark
} from "./schema/GameState.js";

interface ChooseTileMessage {
  side?: Side;
  sides?: Side[];
}

interface JoinOptions {
  name?: string;
  adminPassword?: string;
}

function resetPlayerForRound(player: PlayerState, id: string, name: string): void {
  player.id = id;
  player.name = name;
  player.currentSide = "left";
  player.floor = 1;
  player.runPeakFloor = 1;
  player.bestFloorReached = 1;
  player.failCount = 0;
  player.failEnergy = 0;
  player.hasWon = false;
  player.lastHintAt = 0;
  player.revealedTrapKeys.clear();
  player.respawnAvailableAt = 0;
  refreshPlayerStats(player);
}

export class GameRoom extends Room<GameState> {
  maxClients = 100;
  private readonly branches = new LevelBranchGenerator();
  private readonly adminClientIds = new Set<string>();

  onCreate(): void {
    this.setState(new GameState());
    this.setPatchRate(gameBalance.serverPatchRateMs);

    this.onMessage("chooseTile", (client, msg: ChooseTileMessage) => {
      if (this.state.matchPhase !== "playing") return;
      if (!msg) return;

      let path: Side[] = [];
      if (Array.isArray(msg.sides) && msg.sides.length > 0) {
        path = msg.sides.filter((s): s is Side => s === "left" || s === "right");
        if (path.length !== msg.sides.length) return;
      } else if (msg.side === "left" || msg.side === "right") {
        path = [msg.side];
      }
      if (path.length === 0) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.hasWon) return;

      const result = resolveChoice(player, path, this.branches, Date.now());

      const payload = {
        id: client.sessionId,
        ...result
      };

      if (result.trailMark) {
        const trail = new TrailMark();
        trail.floor = result.trailMark.floor;
        trail.side = result.trailMark.side;
        trail.timestamp = result.trailMark.timestamp;
        this.state.trails.push(trail);
        while (this.state.trails.length > gameBalance.maxTrailMarks) {
          this.state.trails.shift();
        }
      }

      this.broadcast("resolution", payload);
    });

    this.onMessage("requestHint", (client) => {
      if (this.state.matchPhase !== "playing") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      if (now - player.lastHintAt < gameBalance.hintCooldownMs) {
        client.send("hintRejected", {
          nextAt: player.lastHintAt + gameBalance.hintCooldownMs
        });
        return;
      }

      player.lastHintAt = now;
      const branch = this.branches.getBranch(player.floor);
      const hint = new HintResult();
      hint.floor = player.floor;
      hint.safeSide = branch.leftSafe ? "left" : "right";
      hint.expiresAt = now + gameBalance.hintRevealMs;
      this.state.hints.set(client.sessionId, hint);
      client.send("hintGranted", {
        floor: hint.floor,
        safeSide: hint.safeSide,
        expiresAt: hint.expiresAt,
        nickname: player.name
      });
    });

    this.onMessage("adminStart", (client) => {
      if (!this.adminClientIds.has(client.sessionId)) return;
      this.startMatchRound();
    });

    this.onMessage("adminEnd", (client) => {
      if (!this.adminClientIds.has(client.sessionId)) return;
      this.endMatchRound();
    });

    this.onMessage("adminPing", (client) => {
      if (!this.adminClientIds.has(client.sessionId)) return;
      client.send("adminPong", {});
    });
  }

  private startMatchRound(): void {
    this.state.matchPhase = "playing";
    while (this.state.lastRoundStats.length > 0) {
      this.state.lastRoundStats.shift();
    }
    this.branches.clearBranches();
    while (this.state.trails.length > 0) {
      this.state.trails.shift();
    }
    const hintIds: string[] = [];
    this.state.hints.forEach((_h, id) => {
      hintIds.push(id);
    });
    for (const id of hintIds) {
      this.state.hints.delete(id);
    }

    this.state.players.forEach((player, id) => {
      resetPlayerForRound(player, id, player.name);
    });
  }

  private endMatchRound(): void {
    this.state.matchPhase = "ended";
    while (this.state.lastRoundStats.length > 0) {
      this.state.lastRoundStats.shift();
    }
    const hintIds: string[] = [];
    this.state.hints.forEach((_h, id) => {
      hintIds.push(id);
    });
    for (const id of hintIds) {
      this.state.hints.delete(id);
    }
    const players: PlayerState[] = [];
    this.state.players.forEach((p) => {
      players.push(p);
    });
    players.sort((a, b) => {
      if (b.bestFloorReached !== a.bestFloorReached) {
        return b.bestFloorReached - a.bestFloorReached;
      }
      if (a.failCount !== b.failCount) {
        return a.failCount - b.failCount;
      }
      if (a.failEnergy !== b.failEnergy) {
        return a.failEnergy - b.failEnergy;
      }
      return String(a.name).localeCompare(String(b.name));
    });

    for (let i = 0; i < players.length; i++) {
      const player = players[i]!;
      const row = new RoundStatEntry();
      row.rank = i + 1;
      row.name = player.name;
      row.failCount = player.failCount;
      row.bestFloorReached = player.bestFloorReached;
      row.currentFloor = player.floor;
      row.failEnergy = player.failEnergy;
      row.hasWon = player.hasWon;
      this.state.lastRoundStats.push(row);
    }
  }

  onJoin(client: Client, options?: JoinOptions): void {
    const adminPw = options?.adminPassword;
    if (typeof adminPw === "string" && adminPw.length > 0) {
      const cfg = loadAdminConfig();
      if (adminPw === cfg.password) {
        this.adminClientIds.add(client.sessionId);
        return;
      }
      client.send("adminAuthFailed", { reason: "invalid_password" });
      void Promise.resolve().then(() => {
        try {
          client.leave(4401);
        } catch {
          /* noop */
        }
      });
      return;
    }

    const player = new PlayerState();
    const name = options?.name ?? `Player-${client.sessionId.slice(0, 4)}`;
    resetPlayerForRound(player, client.sessionId, name);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.adminClientIds.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.state.hints.delete(client.sessionId);
  }
}
