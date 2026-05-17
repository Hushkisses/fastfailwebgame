import { gameBalance } from "../config/gameBalance.js";
import { trapRevealKey } from "../core/resolver.js";
import { LevelBranchGenerator, type Side } from "../core/grid.js";

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
  trapKnown: Set<string>
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
      if (!finalHop && !gen.isChoiceSafe(fAt, s)) continue;
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
  trapKnown: Set<string>
): PickTarget[] {
  const jp = Math.max(1, Math.floor(jumpPower));
  const out: PickTarget[] = [];
  for (let offset = 0; offset < jp; offset++) {
    const col = startFloor + offset;
    if (startFloor + offset + 1 > gameBalance.goalFloor) continue;
    for (const side of ["left", "right"] as const) {
      const startKey = trapRevealKey(col, side);
      if (trapKnown.has(startKey)) continue;
      const path = inferPathForSlot(gen, startFloor, offset, side, trapKnown);
      if (path) out.push({ floor: col, side, path });
    }
  }
  return out;
}

function pathKey(path: Side[]): string {
  return path.join(",");
}

/** 선택 가능한 타일 중 전진 칸 수가 가장 큰 경로 하나 (동률이면 무작위). */
export function pickFarthestPath(
  gen: LevelBranchGenerator,
  startFloor: number,
  jumpPower: number,
  trapKnown: Set<string>,
  rnd: () => number = Math.random,
  excludePath?: Side[]
): Side[] {
  const targets = buildPickTargets(gen, startFloor, jumpPower, trapKnown);
  if (targets.length === 0) {
    return [rnd() < 0.5 ? "left" : "right"];
  }

  const maxLen = Math.max(...targets.map((t) => t.path.length));
  let candidates = targets.filter((t) => t.path.length === maxLen);

  if (excludePath && excludePath.length > 0) {
    const exc = pathKey(excludePath);
    const without = candidates.filter((t) => pathKey(t.path) !== exc);
    if (without.length > 0) candidates = without;
  }

  const pick = candidates[Math.floor(rnd() * candidates.length)]!;
  return [...pick.path];
}

export function trapKnownFromList(keys: { length: number; [index: number]: string | undefined }): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (typeof k === "string" && k.length > 0) s.add(k);
  }
  return s;
}
