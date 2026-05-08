import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type ScrollSide = "left" | "right";

/** 판정 열(서버 floor) 간격 — 타일끼리 띄움 */
export const TILE_GAP = 150;
export const BRIDGE_MARGIN = 140;

/** 화면 세로 중앙(월드 y=0) 기준 상(L)·하(R) 레인 */
export const LANE_UPPER_Y = -100;
export const LANE_LOWER_Y = 100;

/** 입체 타일 윗면 마름모 — 중심에서 좌우 반폭 */
export const ISO_TOP_HW = 38;
/** 입체 타일 윗면 마름모 — 중심에서 위·아래 반높이 */
export const ISO_TOP_HV = 24;

/** 옆면: 바닥 꼭짓점에서 좌하 방향 변위 */
export const ISO_EXT_SIDE_X = -11;
export const ISO_EXT_SIDE_Y = 20;
/** 앞면: 바닥 꼭짓점에서 우하 방향 변위 */
export const ISO_EXT_FRONT_X = 15;
export const ISO_EXT_FRONT_Y = 20;

/** 픽/히트·레일 여백 추정용 (구 유리 판 반치수 자리) */
export const GLASS_HALF_W = ISO_TOP_HW;
export const GLASS_HALF_H = ISO_TOP_HV + Math.max(ISO_EXT_SIDE_Y, ISO_EXT_FRONT_Y);

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

/** 타일 윗면 기하학적 중심 — 캐릭터 앵커 */
export function avatarWorldPos(floor: number, side: ScrollSide): { x: number; y: number } {
  return tileWorldCenter(floor, side);
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
