import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Side = "left" | "right";

export type StrategySpec = {
  strategy: "random";
  minThinkMs: number;
  maxThinkMs: number;
  hintChance: number;
};

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
          hintChance: g.hintChance
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
    if (g.strategy !== "random") {
      throw new Error(`online-sim-config: strategy는 random만 지원 (${groupId})`);
    }
    if (!Number.isFinite(g.minThinkMs) || !Number.isFinite(g.maxThinkMs) || g.minThinkMs > g.maxThinkMs) {
      throw new Error(`online-sim-config: thinkMs (${groupId})`);
    }
    if (!Number.isFinite(g.hintChance) || g.hintChance < 0 || g.hintChance > 1) {
      throw new Error(`online-sim-config: hintChance (${groupId})`);
    }
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
