import { gameBalance } from "../config/gameBalance.js";
import { computeAuraTierEnergy } from "./aura.js";
import type { Side } from "./grid.js";
import { computeFailureSpeedBoost, computeStatsFromEnergy } from "./stats.js";
import type { PlayerState, TrailMark } from "../rooms/schema/GameState.js";

export interface TileTruth {
  isChoiceSafe(level: number, side: Side): boolean;
}

export function trapRevealKey(floor: number, side: Side): string {
  return `${floor}|${side}`;
}

function knowsTrap(player: PlayerState, key: string): boolean {
  const list = player.revealedTrapKeys;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    if (list[i] === key) return true;
  }
  return false;
}

function rememberTrap(player: PlayerState, key: string): void {
  if (knowsTrap(player, key)) return;
  player.revealedTrapKeys.push(key);
  while (player.revealedTrapKeys.length > 512) {
    player.revealedTrapKeys.shift();
  }
}

export interface ResolveResult {
  success: boolean;
  blockedDuplicate?: boolean;
  respawnLocked?: boolean;
  blockedWall?: boolean;
  fromFloor: number;
  toFloor: number;
  trailMark?: { floor: number; side: Side; timestamp: number };
  gainedEnergy?: number;
  /** 실패 순간까지의 이번 런 최고 층 (보상·UI용) */
  runPeakConsumed?: number;
  syncedJumpPower?: number;
  syncedMoveSpeed?: number;
  syncedEnergy?: number;
}

export function refreshPlayerStats(player: PlayerState): void {
  const stats = computeStatsFromEnergy(player.failEnergy, player.failCount);
  const spdBoost = computeFailureSpeedBoost(player.failCount);
  player.jumpPower = stats.jumpPower;
  player.moveSpeed = Number(
    Math.min(gameBalance.maxMoveSpeed, stats.moveSpeed * spdBoost).toFixed(2)
  );
  player.auraTier = computeAuraTierEnergy(player.failEnergy);
}

/**
 * 이번 Run에서 미끄러지기 전까지의 최고 층(runPeakFloors)에만 의존.
 * 같은 낮은 층을 반복해 얻을 수 있는 보상은 0 또는 미량.
 */
export function simulateFailCharge(runPeakFloors: number): number {
  const peak = Math.max(0, Math.min(runPeakFloors, 380));
  const minPeak = gameBalance.minRunPeakForFailEnergy;

  if (peak < 5) return 0;
  if (peak < minPeak) {
    return Number((gameBalance.failEnergyMicroScale * peak * peak).toFixed(2));
  }

  const s = peak - minPeak + 12;
  return Number(
    (
      gameBalance.failEnergyBaseGrant * Math.pow(1 + s / 30, 1.42) +
      Math.sqrt(Math.max(0, s)) * 0.22
    ).toFixed(2)
  );
}

/**
 * `path`: 서 있을 층에서부터 매 스텝마다 고를 L/R 시퀀스. 길이 1..점프력(내림).
 * 전진 칸 수 = path.length.
 */
export function resolveChoice(player: PlayerState, path: Side[], truth: TileTruth, now: number): ResolveResult {
  const originFloor = player.floor;

  if (player.hasWon) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }

  if (player.respawnAvailableAt > 0 && now < player.respawnAvailableAt) {
    return {
      success: false,
      fromFloor: originFloor,
      toFloor: originFloor,
      respawnLocked: true
    };
  }

  if (player.respawnAvailableAt > 0 && now >= player.respawnAvailableAt) {
    player.respawnAvailableAt = 0;
  }

  const maxHop = Math.max(1, Math.floor(player.jumpPower));
  if (path.length === 0 || path.length > maxHop) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }

  for (const s of path) {
    if (s !== "left" && s !== "right") {
      return { success: false, fromFloor: originFloor, toFloor: originFloor };
    }
  }

  if (originFloor + path.length > gameBalance.goalFloor) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }

  const runPeakBefore = Math.max(player.runPeakFloor, originFloor);

  for (let i = 0; i < path.length; i++) {
    const fPick = originFloor + i;
    const side = path[i]!;
    const choiceKey = trapRevealKey(fPick, side);

    if (knowsTrap(player, choiceKey)) {
      return {
        success: false,
        fromFloor: fPick,
        toFloor: originFloor,
        blockedDuplicate: true
      };
    }

    if (!truth.isChoiceSafe(fPick, side)) {
      return applyTrapFall(player, fPick, runPeakBefore, side, now, false);
    }
  }

  const delta = path.length;
  const targetFloor = Math.min(gameBalance.goalFloor, originFloor + delta);

  if (violatesWall(originFloor, targetFloor, player.jumpPower, player.failEnergy)) {
    const lastF = originFloor + path.length - 1;
    const lastS = path[path.length - 1]!;
    return applyTrapFall(player, lastF, runPeakBefore, lastS, now, true);
  }

  player.floor = targetFloor;
  player.currentSide = path[path.length - 1]!;
  player.runPeakFloor = Math.max(player.runPeakFloor, player.floor);
  player.bestFloorReached = Math.max(player.bestFloorReached, player.floor);

  if (player.floor >= gameBalance.goalFloor) {
    player.hasWon = true;
  }

  return { success: true, fromFloor: originFloor, toFloor: player.floor };
}

function violatesWall(cur: number, next: number, jumpPower: number, failEnergy: number): boolean {
  const lo = Math.min(cur, next);
  const hi = Math.max(cur, next);

  for (const wall of gameBalance.walls) {
    if (!(lo < wall.at && hi >= wall.at)) continue;
    if (jumpPower >= wall.minJumpPower || failEnergy >= wall.minFailEnergy) continue;
    return true;
  }
  return false;
}

function applyTrapFall(
  player: PlayerState,
  fromFloor: number,
  runPeak: number,
  side: Side,
  now: number,
  wallSlam: boolean
): ResolveResult {
  if (!wallSlam) rememberTrap(player, trapRevealKey(fromFloor, side));

  const gained = simulateFailCharge(runPeak);
  player.failEnergy = Number((player.failEnergy + gained).toFixed(2));
  player.failCount += 1;
  refreshPlayerStats(player);
  player.floor = 1;
  player.runPeakFloor = 1;
  player.currentSide = side;
  player.respawnAvailableAt = now + gameBalance.respawnDelayMs;

  return {
    success: false,
    blockedWall: wallSlam,
    fromFloor,
    toFloor: 1,
    trailMark: {
      floor: fromFloor,
      side,
      timestamp: now
    },
    gainedEnergy: gained,
    runPeakConsumed: runPeak,
    syncedJumpPower: player.jumpPower,
    syncedMoveSpeed: player.moveSpeed,
    syncedEnergy: player.failEnergy
  };
}

export function applyTrailMarkLimit(trails: TrailMark[]): TrailMark[] {
  if (trails.length <= gameBalance.maxTrailMarks) return trails;
  return trails.slice(trails.length - gameBalance.maxTrailMarks);
}
