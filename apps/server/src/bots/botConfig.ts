import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Side = "left" | "right";

export type BotStrategy = "bold" | "conservative";

export type StrategySpec = {
  strategy: BotStrategy;
  minThinkMs: number;
  maxThinkMs: number;
  hintChance: number;
  /** conservative: 전 구간 안전한 최장 경로를 고를 확률 */
  correctChance: number;
};

export type BotGroupSpec = {
  id: string;
  label: string;
} & StrategySpec;

export interface BotFillConfig {
  enabled: boolean;
  tickMs: number;
  joinStaggerMs: number;
  groups: BotGroupSpec[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CORRECT_CHANCE = 0.7;

function normalizeStrategy(raw: unknown, groupId: string): BotStrategy {
  if (raw === "conservative") return "conservative";
  if (raw === "bold") return "bold";
  if (raw === "random") return groupId === "conservative" ? "conservative" : "bold";
  return groupId === "conservative" ? "conservative" : "bold";
}

const defaultConfig: BotFillConfig = {
  enabled: true,
  tickMs: 80,
  joinStaggerMs: 40,
  groups: [
    {
      id: "conservative",
      label: "conservative",
      strategy: "conservative",
      minThinkMs: 800,
      maxThinkMs: 2600,
      hintChance: 0.15,
      correctChance: DEFAULT_CORRECT_CHANCE
    },
    {
      id: "bold",
      label: "bold",
      strategy: "bold",
      minThinkMs: 80,
      maxThinkMs: 200,
      hintChance: 0.025,
      correctChance: DEFAULT_CORRECT_CHANCE
    }
  ]
};

function tryRead(p: string): BotFillConfig | null {
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (!Array.isArray(o.groups) || o.groups.length < 2) return null;
    const groups: BotGroupSpec[] = [];
    for (const g of o.groups) {
      if (!g || typeof g !== "object") return null;
      const gr = g as Record<string, unknown>;
      const id = gr.id;
      const label = gr.label;
      if (typeof id !== "string" || typeof label !== "string") return null;
      const minThinkMs = Number(gr.minThinkMs);
      const maxThinkMs = Number(gr.maxThinkMs);
      const hintChance = Number(gr.hintChance);
      if (!Number.isFinite(minThinkMs) || !Number.isFinite(maxThinkMs) || minThinkMs > maxThinkMs) {
        return null;
      }
      if (!Number.isFinite(hintChance) || hintChance < 0 || hintChance > 1) return null;
      const correctRaw = Number(gr.correctChance);
      const correctChance = Number.isFinite(correctRaw)
        ? Math.min(1, Math.max(0, correctRaw))
        : DEFAULT_CORRECT_CHANCE;
      groups.push({
        id,
        label,
        strategy: normalizeStrategy(gr.strategy, id),
        minThinkMs,
        maxThinkMs,
        hintChance,
        correctChance
      });
    }
    return {
      enabled: o.enabled !== false,
      tickMs: Number.isFinite(Number(o.tickMs)) ? Math.max(40, Number(o.tickMs)) : 80,
      joinStaggerMs: Number.isFinite(Number(o.joinStaggerMs))
        ? Math.max(0, Number(o.joinStaggerMs))
        : 40,
      groups
    };
  } catch {
    return null;
  }
}

export function loadBotFillConfig(): BotFillConfig {
  const envPath = process.env.BOT_FILL_CONFIG_PATH;
  const candidates = [
    typeof envPath === "string" && envPath.length > 0 ? path.resolve(envPath) : null,
    path.resolve(process.cwd(), "config", "bot-fill.json"),
    path.join(__dirname, "../../../config/bot-fill.json"),
    path.join(__dirname, "../../../config/bot-fill.example.json")
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const parsed = tryRead(p);
    if (parsed) return parsed;
  }

  console.warn("[bot-fill] config not found; using built-in defaults");
  return { ...defaultConfig };
}

export interface BotRow {
  groupId: string;
  label: string;
  displayName: string;
  spec: StrategySpec;
}

/** 부족 인원을 앞 두 그룹(보수/도전)에 반반 배분해 봇 행 목록 생성 */
export function buildBotRowsForCount(total: number, groups: BotGroupSpec[]): BotRow[] {
  if (total <= 0) return [];
  const a = groups[0]!;
  const b = groups[1]!;
  const half = Math.floor(total / 2);
  const rows: BotRow[] = [];

  const pushGroup = (g: BotGroupSpec, count: number): void => {
    for (let i = 0; i < count; i++) {
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
  };

  pushGroup(a, half);
  pushGroup(b, total - half);
  return rows;
}

export function botServerUrl(): string {
  if (typeof process.env.BOT_FILL_URL === "string" && process.env.BOT_FILL_URL.length > 0) {
    return process.env.BOT_FILL_URL;
  }
  const port = Number(process.env.PORT ?? 2567);
  return `ws://127.0.0.1:${port}`;
}
