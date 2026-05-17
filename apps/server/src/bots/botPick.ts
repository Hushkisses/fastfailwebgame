import { gameBalance } from "../config/gameBalance.js";
import { trapRevealKey } from "../core/resolver.js";
import { LevelBranchGenerator, type Side } from "../core/grid.js";
import type { BotStrategy } from "./botConfig.js";

export type { Side };

export interface PickTarget {
  floor: number;
  side: Side;
  path: Side[];
}

function inferPathForSlot(
  gen: LevelBranchGenerator,
  startFloor: number,
  offset: number,
  side: Side,
  trapKnown: Set<string>,
  useBranchOracle: boolean
): Side[] | null {
  const hops = offset + 1;

  function dfs(prefix: Side[]): Side[] | null {
    const step = prefix.length;
    if (step === hops) {
      return prefix[hops - 1] === side ? prefix : null;
    }
    const fAt = startFloor + step;
    const finalHop = step === hops - 1;
    const choices: Side[] = finalHop ? [side] : ["left", "right"];
    for (const s of choices) {
      const key = trapRevealKey(fAt, s);
      if (trapKnown.has(key)) continue;
      if (useBranchOracle && !finalHop && !gen.isChoiceSafe(fAt, s)) continue;
      const found = dfs([...prefix, s]);
      if (found) return found;
    }
    return null;
  }

  return dfs([]);
}

export function buildPickTargets(
  gen: LevelBranchGenerator,
  startFloor: number,
  jumpPower: number,
  trapKnown: Set<string>,
  useBranchOracle = true
): PickTarget[] {
  const jp = Math.max(1, Math.floor(jumpPower));
  const out: PickTarget[] = [];
  for (let offset = 0; offset < jp; offset++) {
    const col = startFloor + offset;
    if (startFloor + offset + 1 > gameBalance.goalFloor) continue;
    for (const side of ["left", "right"] as const) {
      const startKey = trapRevealKey(col, side);
      if (trapKnown.has(startKey)) continue;
      const path = inferPathForSlot(gen, startFloor, offset, side, trapKnown, useBranchOracle);
      if (path) out.push({ floor: col, side, path });
    }
  }
  return out;
}

function pathKey(path: Side[]): string {
  return path.join(",");
}

function pathIsFullySafe(
  gen: LevelBranchGenerator,
  startFloor: number,
  path: Side[],
  trapKnown: Set<string>
): boolean {
  for (let i = 0; i < path.length; i++) {
    const f = startFloor + i;
    const s = path[i]!;
    if (trapKnown.has(trapRevealKey(f, s))) return false;
    if (!gen.isChoiceSafe(f, s)) return false;
  }
  return true;
}

function farthestCandidates(
  targets: PickTarget[],
  excludePath?: Side[]
): PickTarget[] {
  if (targets.length === 0) return [];
  const maxLen = Math.max(...targets.map((t) => t.path.length));
  let candidates = targets.filter((t) => t.path.length === maxLen);
  if (excludePath && excludePath.length > 0) {
    const exc = pathKey(excludePath);
    const without = candidates.filter((t) => pathKey(t.path) !== exc);
    if (without.length > 0) candidates = without;
  }
  return candidates;
}

/**
 * 공통: 알려진 함정만 피하고 선택 가능한 칸 중 가장 먼 경로 후보를 고른 뒤,
 * - bold: 그중 무작위 (오라클 없음)
 * - conservative: 70%(기본) 확률로 전 구간 안전한 먼 경로, 아니면 먼 경로 중 무작위
 */
export function pickBotPath(
  strategy: BotStrategy,
  gen: LevelBranchGenerator,
  startFloor: number,
  jumpPower: number,
  trapKnown: Set<string>,
  rnd: () => number = Math.random,
  excludePath?: Side[],
  correctChance = 0.7
): Side[] {
  const useOracle = strategy === "conservative";
  const targets = buildPickTargets(gen, startFloor, jumpPower, trapKnown, useOracle);
  if (targets.length === 0) {
    return [rnd() < 0.5 ? "left" : "right"];
  }

  let candidates = farthestCandidates(targets, excludePath);
  if (candidates.length === 0) {
    candidates = farthestCandidates(targets);
  }

  if (strategy === "conservative") {
    const safe = candidates.filter((t) => pathIsFullySafe(gen, startFloor, t.path, trapKnown));
    if (safe.length > 0 && rnd() < correctChance) {
      candidates = safe;
    }
  }

  const pick = candidates[Math.floor(rnd() * candidates.length)]!;
  return [...pick.path];
}

/** @deprecated 테스트·호환 — conservative 오라클 최장 경로 */
export function pickFarthestPath(
  gen: LevelBranchGenerator,
  startFloor: number,
  jumpPower: number,
  trapKnown: Set<string>,
  rnd: () => number = Math.random,
  excludePath?: Side[]
): Side[] {
  return pickBotPath("conservative", gen, startFloor, jumpPower, trapKnown, rnd, excludePath, 1);
}

export function trapKnownFromList(keys: { length: number; [index: number]: string | undefined }): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (typeof k === "string" && k.length > 0) s.add(k);
  }
  return s;
}
