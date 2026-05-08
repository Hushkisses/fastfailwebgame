import { TOWER_TOTAL_FLOORS } from "../config/climbConfig";

export const TOWER_VERT_STEP = 40;
export const TOWER_LANE_OFFSET = 68;
export const TOWER_TILE_HEIGHT = 1;

export type TowerSide = "left" | "right";

export function floorCenterY(floor: number): number {
  return -(floor - 1) * TOWER_VERT_STEP;
}

export function tileWorldCenter(floor: number, side: TowerSide): { x: number; y: number } {
  return {
    x: side === "left" ? -TOWER_LANE_OFFSET : TOWER_LANE_OFFSET,
    y: floorCenterY(floor)
  };
}

export function visibleFloorBand(centerFloor: number, pad: number): { lo: number; hi: number } {
  const lo = Math.max(1, Math.floor(centerFloor - pad));
  const hi = Math.min(TOWER_TOTAL_FLOORS, Math.ceil(centerFloor + pad));
  return { lo, hi };
}

export function parseSide(s: unknown): TowerSide {
  return s === "right" ? "right" : "left";
}

/** 미탐층을 어둡게: 0=밝음, 1=미지 */
export function fogFactorForFloor(floor: number, personalBest: number, currentFloor: number): number {
  const revealed = Math.max(personalBest, currentFloor, 1);
  const gap = floor - revealed;
  if (gap <= 0) return 0;
  if (gap <= 2) return 0.25 + gap * 0.12;
  if (gap <= 6) return 0.55 + (gap - 2) * 0.04;
  return Math.min(0.92, 0.78 + (gap - 6) * 0.02);
}

export function blendFogColor(topRgb: number, fog: number): number {
  if (fog <= 0) return topRgb;
  const bg = 0x12161f;
  const br = (topRgb >> 16) & 255;
  const bgG = (topRgb >> 8) & 255;
  const bb = topRgb & 255;
  const fr = (bg >> 16) & 255;
  const fg = (bg >> 8) & 255;
  const fb = bg & 255;
  const t = Math.min(1, fog);
  const r = Math.floor(br * (1 - t) + fr * t);
  const g = Math.floor(bgG * (1 - t) + fg * t);
  const b = Math.floor(bb * (1 - t) + fb * t);
  return (r << 16) | (g << 8) | b;
}
