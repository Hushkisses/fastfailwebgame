import {
  computeAuraTierEnergy,
  computeFailureSpeedBoost,
  computeJumpPowerFromFailCount,
  computeMoveSpeedFromEnergy,
  soloBalance,
  type SoloAuraTier
} from "./soloBalance";
import { LevelBranchGenerator, type Side } from "../logic/levelBranch";
import { assignShowRecentTileStrip } from "../state/recentTileStripCohort";

/** 서버 `PlayerState` 와 동일한 필드 (오프라인 모드용 평범한 객체) */
export interface SoloPlayer {
  id: string;
  name: string;
  floor: number;
  currentSide: Side;
  runPeakFloor: number;
  bestFloorReached: number;
  failCount: number;
  failEnergy: number;
  jumpPower: number;
  moveSpeed: number;
  auraTier: SoloAuraTier;
  lastHintAt: number;
  hasWon: boolean;
  revealedTrapKeys: string[];
  respawnAvailableAt: number;
  showRecentTileStrip: boolean;
}

export interface SoloTrail {
  floor: number;
  side: Side;
  timestamp: number;
}

export interface SoloHint {
  floor: number;
  safeSide: Side;
  expiresAt: number;
}

export function createSoloPlayer(id: string, name: string): SoloPlayer {
  return {
    id,
    name,
    floor: 1,
    currentSide: "left",
    runPeakFloor: 1,
    bestFloorReached: 1,
    failCount: 0,
    failEnergy: 0,
    jumpPower: 1,
    moveSpeed: soloBalance.baseMoveSpeed,
    auraTier: "blue",
    lastHintAt: 0,
    hasWon: false,
    revealedTrapKeys: [],
    respawnAvailableAt: 0,
    showRecentTileStrip: assignShowRecentTileStrip([])
  };
}

export function refreshPlayerStats(p: SoloPlayer): void {
  const jump = computeJumpPowerFromFailCount(p.failCount);
  const speedRaw = computeMoveSpeedFromEnergy(p.failEnergy);
  const boost = computeFailureSpeedBoost(p.failCount);
  p.jumpPower = jump;
  p.moveSpeed = Number(Math.min(soloBalance.maxMoveSpeed, speedRaw * boost).toFixed(2));
  p.auraTier = computeAuraTierEnergy(p.failEnergy);
}

export function trapRevealKey(floor: number, side: Side): string {
  return `${floor}|${side}`;
}

function knowsTrap(p: SoloPlayer, key: string): boolean {
  return p.revealedTrapKeys.includes(key);
}

function rememberTrap(p: SoloPlayer, key: string): void {
  if (knowsTrap(p, key)) return;
  p.revealedTrapKeys.push(key);
  while (p.revealedTrapKeys.length > 512) p.revealedTrapKeys.shift();
}

export interface SoloResolveResult {
  success: boolean;
  blockedDuplicate?: boolean;
  respawnLocked?: boolean;
  blockedWall?: boolean;
  fromFloor: number;
  toFloor: number;
  trailMark?: SoloTrail;
  gainedEnergy?: number;
  runPeakConsumed?: number;
  syncedJumpPower?: number;
  syncedMoveSpeed?: number;
  syncedEnergy?: number;
}

function simulateFailCharge(runPeakFloors: number): number {
  const peak = Math.max(0, Math.min(runPeakFloors, 380));
  const minPeak = soloBalance.minRunPeakForFailEnergy;
  if (peak < 5) return 0;
  if (peak < minPeak) {
    return Number((soloBalance.failEnergyMicroScale * peak * peak).toFixed(2));
  }
  const s = peak - minPeak + 12;
  return Number(
    (
      soloBalance.failEnergyBaseGrant * Math.pow(1 + s / 30, 1.42) +
      Math.sqrt(Math.max(0, s)) * 0.22
    ).toFixed(2)
  );
}

function violatesWall(cur: number, next: number, jumpPower: number, failEnergy: number): boolean {
  const lo = Math.min(cur, next);
  const hi = Math.max(cur, next);
  for (const wall of soloBalance.walls) {
    if (!(lo < wall.at && hi >= wall.at)) continue;
    if (jumpPower >= wall.minJumpPower || failEnergy >= wall.minFailEnergy) continue;
    return true;
  }
  return false;
}

function applyTrapFall(
  p: SoloPlayer,
  fromFloor: number,
  runPeak: number,
  side: Side,
  now: number,
  wallSlam: boolean
): SoloResolveResult {
  if (!wallSlam) rememberTrap(p, trapRevealKey(fromFloor, side));
  const gained = simulateFailCharge(runPeak);
  p.failEnergy = Number((p.failEnergy + gained).toFixed(2));
  p.failCount += 1;
  refreshPlayerStats(p);
  p.floor = 1;
  p.runPeakFloor = 1;
  p.currentSide = side;
  p.respawnAvailableAt = now + soloBalance.respawnDelayMs;
  return {
    success: false,
    blockedWall: wallSlam,
    fromFloor,
    toFloor: 1,
    trailMark: { floor: fromFloor, side, timestamp: now },
    gainedEnergy: gained,
    runPeakConsumed: runPeak,
    syncedJumpPower: p.jumpPower,
    syncedMoveSpeed: p.moveSpeed,
    syncedEnergy: p.failEnergy
  };
}

export function resolveChoice(
  p: SoloPlayer,
  path: Side[],
  branches: LevelBranchGenerator,
  now: number
): SoloResolveResult {
  const originFloor = p.floor;
  if (p.hasWon) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }
  if (p.respawnAvailableAt > 0 && now < p.respawnAvailableAt) {
    return {
      success: false,
      fromFloor: originFloor,
      toFloor: originFloor,
      respawnLocked: true
    };
  }
  if (p.respawnAvailableAt > 0 && now >= p.respawnAvailableAt) {
    p.respawnAvailableAt = 0;
  }

  const maxHop = Math.max(1, Math.floor(p.jumpPower));
  if (path.length === 0 || path.length > maxHop) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }
  for (const s of path) {
    if (s !== "left" && s !== "right") {
      return { success: false, fromFloor: originFloor, toFloor: originFloor };
    }
  }
  if (originFloor + path.length > soloBalance.goalFloor) {
    return { success: false, fromFloor: originFloor, toFloor: originFloor };
  }

  const runPeakBefore = Math.max(p.runPeakFloor, originFloor);

  for (let i = 0; i < path.length; i++) {
    const fPick = originFloor + i;
    const side = path[i]!;
    const choiceKey = trapRevealKey(fPick, side);
    if (knowsTrap(p, choiceKey)) {
      return {
        success: false,
        fromFloor: fPick,
        toFloor: originFloor,
        blockedDuplicate: true
      };
    }
    if (!branches.isChoiceSafe(fPick, side)) {
      return applyTrapFall(p, fPick, runPeakBefore, side, now, false);
    }
  }

  const delta = path.length;
  const targetFloor = Math.min(soloBalance.goalFloor, originFloor + delta);

  if (violatesWall(originFloor, targetFloor, p.jumpPower, p.failEnergy)) {
    const lastF = originFloor + path.length - 1;
    const lastS = path[path.length - 1]!;
    return applyTrapFall(p, lastF, runPeakBefore, lastS, now, true);
  }

  p.floor = targetFloor;
  p.currentSide = path[path.length - 1]!;
  p.runPeakFloor = Math.max(p.runPeakFloor, p.floor);
  p.bestFloorReached = Math.max(p.bestFloorReached, p.floor);

  if (p.floor >= soloBalance.goalFloor) {
    p.hasWon = true;
  }

  return { success: true, fromFloor: originFloor, toFloor: p.floor };
}
