import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type ScrollSide = "left" | "right";

/** 좌·우 통로 폭 — 두 개의 큰 슬래브가 나란히 */
export const LANE_OFFSET_X = 132;

/** 층 간 세로 간격(월드) */
export const TILE_VERTICAL_GAP = 152;

export const BRIDGE_MARGIN = 140;

/**
 * 평판 슬래브 — 가까운 쪽(관측자) 가로 반폭 (월드 단위).
 * 세로로 긴 마름모형 대신 **가로로 넓은 직사각형** 느낌의 기준치.
 */
export const SLAB_HALF_WIDTH = 108;

/** 윗면이 화면에서 차지하는 얇은 두께(원근 박스 높이) */
export const SLAB_TOP_THICK = 7;

/** 카메라 쪽으로 보이는 얇은 앞 립 두께 (물리적으로 얇은 발판) */
export const SLAB_LIP_DEPTH = 12;

/** 픽/히트 박스용 (구 ISO 호환 이름) */
export const ISO_TOP_HW = SLAB_HALF_WIDTH;
export const ISO_TOP_HV = SLAB_TOP_THICK;
export const ISO_FRONT_DEPTH = SLAB_LIP_DEPTH;
export const ISO_SIDE_DEPTH_X = 6;
export const ISO_SIDE_DEPTH_Y = 5;

export const GLASS_HALF_W = SLAB_HALF_WIDTH + 8;
export const GLASS_HALF_H = SLAB_TOP_THICK + SLAB_LIP_DEPTH + 4;

export const TILE_GAP = TILE_VERTICAL_GAP;

export const ABYSS_EXTRA_Y = 300;

export function floorWorldY(floor: number): number {
  return -(Math.max(1, floor) - 1) * TILE_VERTICAL_GAP;
}

/** 멀수록 작아지는 기본 원근 */
export function tilePerspectiveScale(tileFloor: number, viewerFloor: number): number {
  const d = tileFloor - viewerFloor;
  if (d <= 0) return Math.min(1.12, 1.04 - d * 0.012);
  const inv = 1 / (1 + d * 0.125);
  return Math.max(0.12, inv);
}

export function tileWorldPos(
  floor: number,
  side: ScrollSide,
  viewerFloor: number
): { x: number; y: number; scale: number } {
  let scale = tilePerspectiveScale(floor, viewerFloor);
  const d = floor - viewerFloor;
  /** 바로 앞 선택 한 줄 — 화면을 크게 채움 (좌·우 압박) */
  if (d === 1) scale *= 1.72;
  else if (d === 2) scale *= 1.12;
  else if (d >= 8) scale *= 0.92;

  const laneBase = side === "left" ? -LANE_OFFSET_X : LANE_OFFSET_X;
  const converge = 0.32 + 0.68 * Math.min(1, scale * 1.05);
  return {
    x: laneBase * converge,
    y: floorWorldY(floor),
    scale
  };
}

export function tileWorldCenter(floor: number, side: ScrollSide): { x: number; y: number } {
  const x = side === "left" ? -LANE_OFFSET_X : LANE_OFFSET_X;
  return { x, y: floorWorldY(floor) };
}

export function avatarWorldPos(floor: number, side: ScrollSide, viewerFloor: number): { x: number; y: number } {
  const p = tileWorldPos(floor, side, viewerFloor);
  return { x: p.x, y: p.y };
}

export function fallTargetStartWorld(): { x: number; y: number } {
  return { x: 0, y: floorWorldY(1) + ABYSS_EXTRA_Y };
}

export function visibleColumnBand(centerFloor: number): { lo: number; hi: number } {
  const lo = Math.max(1, Math.floor(centerFloor - TOWER_CULL_RADIUS_FLOORS));
  const hi = Math.min(CLIENT_GOAL_FLOOR, Math.ceil(centerFloor + TOWER_CULL_RADIUS_FLOORS));
  return { lo, hi };
}

export function columnFog(column: number, personalBest: number, currentColumn: number): number {
  const revealed = Math.max(personalBest, currentColumn, 1);
  const gap = column - revealed;
  if (gap <= 0) return 0;
  if (gap <= 2) return 0.2 + gap * 0.12;
  if (gap <= 8) return 0.48 + (gap - 2) * 0.035;
  return Math.min(0.9, 0.74 + (gap - 8) * 0.016);
}

export function mutedLaneColor(side: ScrollSide, fog: number): number {
  const base = side === "left" ? 0x72d7ff : 0xffafd0;
  return blendFogColor(base, fog);
}
