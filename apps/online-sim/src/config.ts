import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BotStrategy, StrategySpec } from "../../server/src/bots/botConfig.js";

export type { BotStrategy, StrategySpec };

export type OnlineSimGroup = {
  id: string;
  label: string;
  count: number;
} & StrategySpec;

export interface OnlineSimConfig {
  url: string;
  /** 비우면 라운드는 관리자 UI에서 직접 시작·종료해야 합니다. */
  adminPassword: string;
  joinStaggerMs: number;
  roundDurationMs: number;
  outputDir: string;
  tickMs: number;
  groups: OnlineSimGroup[];
}

const DEFAULT_CORRECT_CHANCE = 0.7;

function normalizeStrategy(raw: unknown, groupId: string): BotStrategy {
  if (raw === "conservative") return "conservative";
  if (raw === "bold") return "bold";
  if (raw === "random") return groupId === "conservative" ? "conservative" : "bold";
  return groupId === "conservative" ? "conservative" : "bold";
}

export function expandBotRows(cfg: OnlineSimConfig): { groupId: string; label: string; displayName: string; spec: StrategySpec }[] {
  const rows: { groupId: string; label: string; displayName: string; spec: StrategySpec }[] = [];
  for (const g of cfg.groups) {
    for (let i = 0; i < g.count; i++) {
      rows.push({
        groupId: g.id,
        label: g.label,
        displayName: `[${g.id}:${i}] ${g.label}`,
        spec: {
          strategy: g.strategy,
          minThinkMs: g.minThinkMs,
          maxThinkMs: g.maxThinkMs,
          hintChance: g.hintChance,
          correctChance: g.correctChance
        }
      });
    }
  }
  return rows;
}

export function loadOnlineSimConfig(path: string): OnlineSimConfig {
  const abs = resolve(path);
  const j = JSON.parse(readFileSync(abs, "utf8")) as OnlineSimConfig;
  if (!j.groups?.length) throw new Error("online-sim-config: groups 비어 있음");
  for (const g of j.groups) {
    const groupId = g.id;
    if (!groupId || !g.label) throw new Error("online-sim-config: id/label 필수");
    if (!Number.isFinite(g.count) || g.count < 1) throw new Error(`online-sim-config: count >= 1 (${groupId})`);
    const strategy = normalizeStrategy(g.strategy, groupId);
    if (!Number.isFinite(g.minThinkMs) || !Number.isFinite(g.maxThinkMs) || g.minThinkMs > g.maxThinkMs) {
      throw new Error(`online-sim-config: thinkMs (${groupId})`);
    }
    if (!Number.isFinite(g.hintChance) || g.hintChance < 0 || g.hintChance > 1) {
      throw new Error(`online-sim-config: hintChance (${groupId})`);
    }
    const correctRaw = Number(g.correctChance);
    g.correctChance = Number.isFinite(correctRaw)
      ? Math.min(1, Math.max(0, correctRaw))
      : DEFAULT_CORRECT_CHANCE;
    g.strategy = strategy;
  }
  j.url = typeof j.url === "string" ? j.url : "ws://localhost:2567";
  j.adminPassword = typeof j.adminPassword === "string" ? j.adminPassword : "";
  j.joinStaggerMs = Number.isFinite(j.joinStaggerMs) ? Math.max(0, j.joinStaggerMs) : 40;
  j.roundDurationMs = Number.isFinite(j.roundDurationMs) ? Math.max(5000, j.roundDurationMs) : 180_000;
  j.outputDir = typeof j.outputDir === "string" ? j.outputDir : "out";
  j.tickMs = Number.isFinite(j.tickMs) ? Math.max(40, j.tickMs) : 80;
  return j;
}

export function parseGroupFromDisplayName(name: string): { groupId: string; index: number } | null {
  const m = /^\[([^:]+):(\d+)\]/.exec(name);
  if (!m) return null;
  return { groupId: m[1]!, index: Number(m[2]) };
}
