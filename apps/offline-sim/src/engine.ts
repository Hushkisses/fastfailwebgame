import { LevelBranchGenerator, type Side } from "../../client/src/logic/levelBranch.ts";
import {
  createSoloPlayer,
  resolveChoice,
  trapRevealKey,
  type SoloPlayer
} from "../../client/src/sim/soloPlayer.ts";
import { soloBalance } from "../../client/src/sim/soloBalance.ts";
import type { SimGroupConfig, ThinkMsSpec } from "./config.js";

export interface ActiveHint {
  floor: number;
  safeSide: Side;
  expiresAt: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleThinkMs(spec: ThinkMsSpec, rnd: () => number): number {
  if (spec.type === "uniform") {
    return spec.min + rnd() * (spec.max - spec.min);
  }
  const u1 = rnd() || 1e-12;
  const u2 = rnd();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const v = spec.mean + z * spec.sd;
  return Math.min(spec.max, Math.max(spec.min, v));
}

function sideNotKnownBad(p: SoloPlayer, floor: number, side: Side): boolean {
  return !p.revealedTrapKeys.includes(trapRevealKey(floor, side));
}

function hintAppliesToFloor(h: ActiveHint | null, now: number, floor: number): h is ActiveHint {
  return h !== null && now < h.expiresAt && h.floor === floor;
}

function pickSideForFloor(
  p: SoloPlayer,
  floor: number,
  hint: ActiveHint | null,
  now: number,
  rnd: () => number
): Side {
  const leftOk = sideNotKnownBad(p, floor, "left");
  const rightOk = sideNotKnownBad(p, floor, "right");
  const candidates: Side[] = [];
  if (leftOk) candidates.push("left");
  if (rightOk) candidates.push("right");
  if (candidates.length === 0) return rnd() < 0.5 ? "left" : "right";
  if (candidates.length === 1) return candidates[0]!;

  if (hintAppliesToFloor(hint, now, floor)) {
    if (candidates.includes(hint.safeSide)) return hint.safeSide;
  }
  return candidates[Math.floor(rnd() * candidates.length)]!;
}

function buildPath(
  p: SoloPlayer,
  originFloor: number,
  pathLen: number,
  hint: ActiveHint | null,
  now: number,
  rnd: () => number
): Side[] {
  const path: Side[] = [];
  for (let i = 0; i < pathLen; i++) {
    const f = originFloor + i;
    if (f >= soloBalance.goalFloor) break;
    path.push(pickSideForFloor(p, f, hint, now, rnd));
  }
  return path;
}

function pathViolatesKnownTraps(p: SoloPlayer, originFloor: number, path: Side[]): boolean {
  for (let i = 0; i < path.length; i++) {
    const f = originFloor + i;
    const s = path[i]!;
    if (!sideNotKnownBad(p, f, s)) return true;
  }
  return false;
}

export interface RunResultRow {
  groupId: string;
  groupLabel: string;
  botIndex: number;
  won: boolean;
  failCount: number;
  bestFloorReached: number;
  hintsUsed: number;
  totalThinkMs: number;
  thinkDecisions: number;
  steps: number;
}

export function runOneBot(
  profile: SimGroupConfig,
  groupIndex: number,
  botIndex: number,
  baseSeed: number,
  maxSteps: number
): RunResultRow {
  const rng = mulberry32((baseSeed + groupIndex * 1_000_003 + botIndex * 17_389) >>> 0);
  const rnd = () => rng();

  const branches = new LevelBranchGenerator();
  const id = `${profile.id}-${botIndex}`;
  const p = createSoloPlayer(id, `${profile.label}#${botIndex}`);
  let virtualNow = 1_000_000;
  let activeHint: ActiveHint | null = null;
  let hintsUsed = 0;
  let totalThinkMs = 0;
  let thinkDecisions = 0;
  let steps = 0;

  while (steps < maxSteps) {
    if (p.hasWon) break;

    if (p.respawnAvailableAt > virtualNow) {
      virtualNow = p.respawnAvailableAt + 1;
      continue;
    }

    if (activeHint && virtualNow >= activeHint.expiresAt) {
      activeHint = null;
    }

    const hasHintForCurrentFloor = hintAppliesToFloor(activeHint, virtualNow, p.floor);
    let think = sampleThinkMs(profile.thinkMs, rnd);
    if (hasHintForCurrentFloor) think *= profile.afterHintThinkScale;
    virtualNow += think;
    totalThinkMs += think;
    thinkDecisions += 1;

    if (rnd() < profile.hintBaseChance) {
      if (virtualNow - p.lastHintAt >= soloBalance.hintCooldownMs) {
        p.lastHintAt = virtualNow;
        const branch = branches.getBranch(p.floor);
        const safeSide: Side = branch.leftSafe ? "left" : "right";
        activeHint = {
          floor: p.floor,
          safeSide,
          expiresAt: virtualNow + soloBalance.hintRevealMs
        };
        hintsUsed += 1;
        virtualNow += 40;
      }
    }

    if (activeHint && virtualNow >= activeHint.expiresAt) {
      activeHint = null;
    }

    const maxHop = Math.max(1, Math.floor(p.jumpPower));
    const remaining = soloBalance.goalFloor - p.floor;
    const pathLen = profile.preferSingleStep ? 1 : Math.min(maxHop, remaining);
    let path = buildPath(p, p.floor, pathLen, activeHint, virtualNow, rnd);

    if (path.length === 0) path = ["left"];

    let resolved = false;
    for (let attempt = 0; attempt < 24 && !resolved; attempt++) {
      if (pathViolatesKnownTraps(p, p.floor, path)) {
        path = buildPath(p, p.floor, pathLen, activeHint, virtualNow, rnd);
        continue;
      }
      const res = resolveChoice(p, path, branches, virtualNow);
      steps += 1;

      if (res.respawnLocked) {
        virtualNow = p.respawnAvailableAt + 1;
        resolved = true;
        break;
      }
      if (res.blockedDuplicate) {
        path = buildPath(p, p.floor, pathLen, activeHint, virtualNow, rnd);
        continue;
      }

      virtualNow += 60;
      resolved = true;

      if (!res.success) {
        virtualNow = Math.max(virtualNow, p.respawnAvailableAt + 1);
      }
      break;
    }

    if (!resolved) {
      const res = resolveChoice(p, ["left"], branches, virtualNow);
      steps += 1;
      virtualNow += 60;
      if (!res.success) {
        virtualNow = Math.max(virtualNow, p.respawnAvailableAt + 1);
      }
    }
  }

  return {
    groupId: profile.id,
    groupLabel: profile.label,
    botIndex,
    won: p.hasWon,
    failCount: p.failCount,
    bestFloorReached: p.bestFloorReached,
    hintsUsed,
    totalThinkMs,
    thinkDecisions,
    steps
  };
}
