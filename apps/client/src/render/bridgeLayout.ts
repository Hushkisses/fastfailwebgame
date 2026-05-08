import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type BridgeSide = "left" | "right";

/** 쿼터뷰: 다리가 화면 위쪽(멀리)으로 뻗음 */
const SHEAR = 0.42;
const ROW_DEPTH = 46;
const LANE = 76;

export function bridgeRowCenter(row: number, side: BridgeSide): { x: number; y: number } {
  const fwd = Math.max(0, row - 1);
  const lane = side === "left" ? -LANE : LANE;
  const x = fwd * ROW_DEPTH * SHEAR + lane;
  const y = 300 - fwd * ROW_DEPTH;
  return { x, y };
}

export function rowPerspectiveScale(row: number): number {
  const fwd = Math.max(0, row - 1);
  return Math.max(0.66, 1 - fwd * 0.0028);
}

export function bridgeStartPlatform(): { x: number; y: number } {
  const b = bridgeRowCenter(1, "left");
  return { x: 0, y: b.y + 86 };
}

export function avatarBridgePos(floor: number, side: BridgeSide): { x: number; y: number } {
  if (floor <= 1) {
    const b = bridgeStartPlatform();
    return { x: b.x * 0.35, y: b.y - 6 };
  }
  const p = bridgeRowCenter(floor, side);
  const sc = rowPerspectiveScale(floor);
  return { x: p.x, y: p.y + 16 * sc };
}

export function visibleRowBand(centerRow: number, pad = TOWER_CULL_RADIUS_FLOORS): { lo: number; hi: number } {
  const lo = Math.max(1, Math.floor(centerRow - pad));
  const hi = Math.min(CLIENT_GOAL_FLOOR, Math.ceil(centerRow + pad));
  return { lo, hi };
}

export function rowFogFactor(row: number, personalBest: number, currentRow: number): number {
  const revealed = Math.max(personalBest, currentRow, 1);
  const gap = row - revealed;
  if (gap <= 0) return 0;
  if (gap <= 2) return 0.22 + gap * 0.14;
  if (gap <= 8) return 0.52 + (gap - 2) * 0.038;
  return Math.min(0.93, 0.78 + (gap - 8) * 0.018);
}

export function mutedGlassColor(side: BridgeSide, fog: number): number {
  const base = side === "left" ? 0x5ecbff : 0xff9ec4;
  return blendFogColor(base, fog);
}
