import { Room, Client } from "colyseus";
import { gameBalance } from "../config/gameBalance.js";
import { LevelBranchGenerator, type Side } from "../core/grid.js";
import { refreshPlayerStats, resolveChoice } from "../core/resolver.js";
import { GameState, HintResult, PlayerState, TrailMark } from "./schema/GameState.js";

interface ChooseTileMessage {
  side?: Side;
  sides?: Side[];
}

export class GameRoom extends Room<GameState> {
  maxClients = 100;
  private readonly branches = new LevelBranchGenerator();

  onCreate(): void {
    this.setState(new GameState());
    this.setPatchRate(gameBalance.serverPatchRateMs);

    this.onMessage("chooseTile", (client, msg: ChooseTileMessage) => {
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
  }

  onJoin(client: Client, options?: { name?: string }): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = options?.name ?? `Player-${client.sessionId.slice(0, 4)}`;
    player.currentSide = "left";
    player.floor = 1;
    player.runPeakFloor = 1;
    player.bestFloorReached = 1;
    player.failEnergy = 0;
    player.hasWon = false;
    player.revealedTrapKeys.clear();
    player.respawnAvailableAt = 0;
    refreshPlayerStats(player);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.state.hints.delete(client.sessionId);
  }
}
