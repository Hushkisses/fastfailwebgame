import { CLIENT_GOAL_FLOOR, TOWER_CULL_RADIUS_FLOORS } from "../config/climbConfig";
import { blendFogColor } from "./towerLayout";

export type ScrollSide = "left" | "right";

/** 화면 중앙 기준 좌·우 레인 X 오프셋 — 바로 앞 두 개의 큰 발판 간격 */
export const LANE_OFFSET_X = 118;

/**
 * 층 간 세로 간격(월드). 값이 클수록 타일이 더 뜨고 낙하 깊이감이 커짐.
 */
export const TILE_VERTICAL_GAP = 148;

/** 레일·보이드 여백 */
export const BRIDGE_MARGIN = 140;

/** 입체 타일 — 윗면(발판) 반가로 (1인칭에 가깝게 크게) */
export const ISO_TOP_HW = 52;
/** 입체 타일 — 윗면 반세로 */
export const ISO_TOP_HV = 20;

/** 유저를 향하는 앞면 두께 — 직사각형 슬랩 느낌 */
export const ISO_FRONT_DEPTH = 54;

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

/** 멀리 갈수록 작아져 어둠 속으로 사라지는 원근 (깊은 소실) */
export function tilePerspectiveScale(tileFloor: number, viewerFloor: number): number {
  const d = tileFloor - viewerFloor;
  if (d <= 0) return Math.min(1.14, 1.06 - d * 0.01);
  const inv = 1 / (1 + d * 0.112);
  return Math.max(0.16, inv);
}

/** 원근 적용 월드 좌표 + 타일 스케일 (멀수록 통로 중앙으로 수렴) */
export function tileWorldPos(
  floor: number,
  side: ScrollSide,
  viewerFloor: number
): { x: number; y: number; scale: number } {
  let scale = tilePerspectiveScale(floor, viewerFloor);
  const d = floor - viewerFloor;
  /** 바로 다음 줄 선택지는 화면을 많이 채우도록 약간 확대 */
  if (d === 1) scale *= 1.22;
  else if (d === 2) scale *= 1.06;

  const laneBase = side === "left" ? -LANE_OFFSET_X : LANE_OFFSET_X;
  const converge = 0.38 + 0.62 * Math.min(1, scale * 1.15);
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
