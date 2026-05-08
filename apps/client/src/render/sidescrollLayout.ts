import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type ScrollSide = "left" | "right";

/** 판정 열(서버 floor) 간격 — 100px 초과, 직교 X만 사용 */
export const TILE_GAP = 118;
export const BRIDGE_MARGIN = 140;

/** 화면 세로 중앙(월드 y=0) 기준 상·하 레인 — 완전 수평 */
export const LANE_UPPER_Y = -122;
export const LANE_LOWER_Y = 122;

export const GLASS_HALF_W = 40;
export const GLASS_HALF_H = 78;

/** 픽/깨짐 등: 서버 floor 열의 정면 중심 (두 레인 동일 x) */
export function tileWorldCenter(column: number, side: ScrollSide): { x: number; y: number } {
  const x = Math.max(1, column) * TILE_GAP;
  const y = side === "left" ? LANE_UPPER_Y : LANE_LOWER_Y;
  return { x, y };
}

/** 선택지 열의 월드 x (동일) */
export function choiceColumnWorldX(serverFloor: number): number {
  return Math.max(1, serverFloor) * TILE_GAP;
}

/**
 * 캐릭터 배치: 선택 열의 **왼쪽**(뒤쪽) x, **타일 상단** y — 유리 색이 가려지지 않음.
 */
const AVATAR_BACK = 78;

export function avatarWorldPos(floor: number, side: ScrollSide): { x: number; y: number } {
  const tc = tileWorldCenter(floor, side);
  let x = tc.x - AVATAR_BACK;
  if (floor <= 1) x = Math.min(tc.x - AVATAR_BACK, TILE_GAP * 0.38);
  const yTop = tc.y - GLASS_HALF_H - 10;
  return { x, y: yTop };
}

export function fallTargetStartWorld(): { x: number; y: number } {
  return { x: -Math.floor(TILE_GAP * 0.55), y: 0 };
}

export function visibleColumnBand(centerRow: number): { lo: number; hi: number } {
  const lo = Math.max(1, Math.floor(centerRow - TOWER_CULL_RADIUS_FLOORS));
  const hi = Math.min(CLIENT_GOAL_FLOOR, Math.ceil(centerRow + TOWER_CULL_RADIUS_FLOORS));
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
