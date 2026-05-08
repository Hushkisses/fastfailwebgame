import { Graphics } from "pixi.js";
import { CUBE_WALL_DROP, TILE_DEPTH, TILE_HEIGHT, TILE_WIDTH } from "../map/constants";
import type { Tile } from "../map/tile";

function shadeRgb(hex: number, factor: number): number {
  const r = Math.min(255, Math.floor((((hex >> 16) & 255) * factor)));
  const g = Math.min(255, Math.floor((((hex >> 8) & 255) * factor)));
  const b = Math.min(255, Math.floor(((hex & 255) * factor)));
  return (r << 16) | (g << 8) | b;
}

const hw = TILE_WIDTH / 2;
const hh = TILE_HEIGHT / 2;
const depth = CUBE_WALL_DROP;

function drawTopFace(g: Graphics, cx: number, cy: number, topColor: number): void {
  g.moveTo(cx, cy - hh)
    .lineTo(cx + hw, cy)
    .lineTo(cx, cy + hh)
    .lineTo(cx - hw, cy)
    .closePath()
    .fill(topColor)
    .stroke({ color: shadeRgb(topColor, 0.55), width: 1 });
}

function drawSideLeft(g: Graphics, cx: number, cy: number, sideColor: number): void {
  g.moveTo(cx - hw, cy)
    .lineTo(cx, cy + hh)
    .lineTo(cx + 6, cy + hh + depth)
    .lineTo(cx - hw - 4, cy + depth * 0.62)
    .closePath()
    .fill(sideColor)
    .stroke({ color: shadeRgb(sideColor, 0.45), width: 1 });
}

function drawSideRight(g: Graphics, cx: number, cy: number, sideColor: number): void {
  g.moveTo(cx + hw, cy)
    .lineTo(cx, cy + hh)
    .lineTo(cx - 6, cy + hh + depth)
    .lineTo(cx + hw + 4, cy + depth * 0.62)
    .closePath()
    .fill(sideColor)
    .stroke({ color: shadeRgb(sideColor, 0.45), width: 1 });
}

/** 실패 표시를 윗면 위에 얇게 */
function drawFailXOnTop(g: Graphics, cx: number, cyTop: number, failCount: number): void {
  const falls = Math.max(1, failCount);
  const t = Math.min(1, 0.35 + falls / 14);
  const w = 1.5 + t * 5;
  const s = 6 + t * 10;
  const cy = cyTop - hh * 0.2;
  g.moveTo(cx - s, cy - s)
    .lineTo(cx + s, cy + s)
    .moveTo(cx + s, cy - s)
    .lineTo(cx - s, cy + s)
    .stroke({ color: 0xff3e3e, width: w, alpha: 0.75 + t * 0.22 });
}

/**
 * 쿼터뷰 육면체 타일 하나.
 * @param sx,sy 그리드→화면 바닥면 기준점(윗마름모 중심이 아님) — 현재 규격은 gridToScreen 과 동일한 중심
 * @param height 솟음 단계에 따라 위로 TILE_DEPTH 픽셀 배수만큼 당김
 */
export function drawTile(g: Graphics, sx: number, sy: number, height: number, topColor: number, tile?: Tile): void {
  const cyElev = sy - Math.max(0, height) * TILE_DEPTH;

  const topSide = shadeRgb(topColor, 0.92);
  const leftSide = shadeRgb(topColor, 0.62);
  const rightSide = shadeRgb(topColor, 0.5);

  drawSideLeft(g, sx, cyElev, leftSide);
  drawSideRight(g, sx, cyElev, rightSide);
  drawTopFace(g, sx, cyElev, topSide);

  if (tile?.type === "trap" && (tile.isRevealed || tile.failCount > 0)) {
    drawFailXOnTop(g, sx, cyElev, tile.failCount > 0 ? tile.failCount : 1);
  }
}
