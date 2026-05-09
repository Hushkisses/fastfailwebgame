import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type ScrollSide = "left" | "right";

/** 화면 중앙 기준 좌·우 레인 X 오프셋 (두 줄 다리) */
export const LANE_OFFSET_X = 96;

/**
 * 층 간 세로 간격(월드). 값이 클수록 타일이 더 뜨고 낙하 깊이감이 커짐.
 */
export const TILE_VERTICAL_GAP = 138;

/** 레일·보이드 여백 */
export const BRIDGE_MARGIN = 140;

/** 입체 타일 — 윗면(발판) 마름모 반가로 */
export const ISO_TOP_HW = 42;
/** 입체 타일 — 윗면 마름모 반세로 (화면 위쪽이 등 뒤) */
export const ISO_TOP_HV = 18;

/** 유저를 향하는 앞면 두께 (+Y 방향, 화면 아래로) */
export const ISO_FRONT_DEPTH = 46;

/** 좌우 얇은 옆면 깊이 보정 */
export const ISO_SIDE_DEPTH_X = 12;
export const ISO_SIDE_DEPTH_Y = 22;

/** 픽/히트 영역 추정 */
export const GLASS_HALF_W = ISO_TOP_HW + 6;
export const GLASS_HALF_H = ISO_TOP_HV + ISO_FRONT_DEPTH;

/** 하위 호환: 예전 가로 간격 필드명 → 세로 간격 */
export const TILE_GAP = TILE_VERTICAL_GAP;

/** 낙하 연출 목표(심연 방향). floor 1보다 화면 아래(+Y)로 충분히 */
export const ABYSS_EXTRA_Y = 280;

export function floorWorldY(floor: number): number {
  return -(Math.max(1, floor) - 1) * TILE_VERTICAL_GAP;
}

/** 멀리 있는 층일수록 작아지는 원근 스케일 (1 = 플레이어와 같은 열) */
export function tilePerspectiveScale(tileFloor: number, viewerFloor: number): number {
  const d = tileFloor - viewerFloor;
  if (d <= 0) return Math.min(1.06, 1 - d * 0.004);
  return Math.max(0.52, 1 - d * 0.012);
}

/** 원근 적용 월드 좌표 + 타일 스케일 (좌우 레인이 원점 쪽으로 살짝 수렴) */
export function tileWorldPos(
  floor: number,
  side: ScrollSide,
  viewerFloor: number
): { x: number; y: number; scale: number } {
  const scale = tilePerspectiveScale(floor, viewerFloor);
  const laneBase = side === "left" ? -LANE_OFFSET_X : LANE_OFFSET_X;
  const converge = 0.78 + 0.22 * scale;
  return {
    x: laneBase * converge,
    y: floorWorldY(floor),
    scale
  };
}

/** 원근 없는 기하 중심 (레거시·히트 추정 보조) */
export function tileWorldCenter(floor: number, side: ScrollSide): { x: number; y: number } {
  const x = side === "left" ? -LANE_OFFSET_X : LANE_OFFSET_X;
  return { x, y: floorWorldY(floor) };
}

/** 타일 위 캐릭터 앵커 — 시점 기준 원근 좌표 */
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
