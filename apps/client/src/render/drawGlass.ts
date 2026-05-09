import { Graphics } from "pixi.js";
import {
  ISO_FRONT_DEPTH,
  ISO_SIDE_DEPTH_X,
  ISO_SIDE_DEPTH_Y,
  ISO_TOP_HW,
  ISO_TOP_HV,
  type ScrollSide
} from "./sidescrollLayout";
import { blendFogColor } from "./towerLayout";

const BRIDGE_TOP_BASE = 0x4488ff;
const BRIDGE_SIDE_BASE = 0x224488;
const BRIDGE_FRONT_BASE = 0x112244;
const LANE_PINK = 0xff99cc;

/** ClimbStage 픽 박스 호환 */
export const ISO_EXT_FRONT_Y = ISO_FRONT_DEPTH;

function mixRgb(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.floor(ar * (1 - t) + br * t);
  const g = Math.floor(ag * (1 - t) + bg * t);
  const bl = Math.floor(ab * (1 - t) + bb * t);
  return (r << 16) | (g << 8) | bl;
}

function fillQuad(
  g: Graphics,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  fill: { color: number; alpha: number }
): void {
  g.moveTo(ax, ay).lineTo(bx, by).lineTo(cx, cy).lineTo(dx, dy).closePath().fill(fill);
}

/**
 * 하단 시점 입체 블록: 윗면(발판) → 좌우 얇은 옆면 → 두꺼운 앞면(유저 시선).
 * (+Y는 화면 아래 = 카메라 쪽)
 */
export function drawBridgeVerticalBlock(
  g: Graphics,
  cx: number,
  cy: number,
  opts: {
    fog: number;
    broken: boolean;
    glow: number;
    lane: ScrollSide;
    scale?: number;
    neonPick?: boolean;
  }
): void {
  const { fog, broken, glow, lane, neonPick = false } = opts;
  const sc = opts.scale ?? 1;
  const laneMix = lane === "right" ? 0.24 : 0;

  let topC = mixRgb(BRIDGE_TOP_BASE, LANE_PINK, laneMix);
  let sideC = mixRgb(BRIDGE_SIDE_BASE, LANE_PINK, laneMix * 0.55);
  let frontC = mixRgb(BRIDGE_FRONT_BASE, LANE_PINK, laneMix * 0.45);

  if (broken) {
    const d = Math.min(1, fog + 0.38);
    topC = blendFogColor(0x3a4a5c, d);
    sideC = blendFogColor(0x243448, d);
    frontC = blendFogColor(0x152030, d);
  } else {
    topC = blendFogColor(topC, fog);
    sideC = blendFogColor(sideC, fog);
    frontC = blendFogColor(frontC, fog);
  }

  const hw = ISO_TOP_HW * sc;
  const hv = ISO_TOP_HV * sc;
  const tx = cx;
  const ty = cy - hv;
  const rx = cx + hw;
  const ry = cy;
  const bx = cx;
  const by = cy + hv;
  const lx = cx - hw;
  const ly = cy;

  const sdx = ISO_SIDE_DEPTH_X * sc;
  const sdy = ISO_SIDE_DEPTH_Y * sc;
  const D = ISO_FRONT_DEPTH * sc;

  fillQuad(g, lx, ly, tx, ty, tx - sdx, ty + sdy, lx - sdx * 0.85, ly + sdy * 0.92, { color: sideC, alpha: 1 });
  fillQuad(g, tx, ty, rx, ry, rx + sdx * 0.85, ry + sdy * 0.92, tx + sdx, ty + sdy, { color: sideC, alpha: 1 });

  const fwTop = hw + 10 * sc;
  const fwBot = hw * 0.72;
  const fy0 = by - 4 * sc;
  const fy1 = by + D;
  fillQuad(
    g,
    cx - fwTop,
    fy0,
    cx + fwTop,
    fy0,
    cx + fwBot,
    fy1,
    cx - fwBot,
    fy1,
    { color: frontC, alpha: 1 }
  );

  const topAlpha = broken ? 0.42 : Math.min(0.92, 0.6 + glow * 0.32);
  g.moveTo(tx, ty)
    .lineTo(rx, ry)
    .lineTo(bx, by)
    .lineTo(lx, ly)
    .closePath()
    .fill({ color: topC, alpha: topAlpha })
    .stroke({
      width: (1.15 + glow * 2.8) * sc,
      color: 0xffffff,
      alpha: broken ? 0.12 : 0.14 + glow * 0.52
    });

  if (neonPick && !broken) {
    const neon = lane === "left" ? 0x44eeff : 0xd466ff;
    g.moveTo(tx, ty)
      .lineTo(rx, ry)
      .lineTo(bx, by)
      .lineTo(lx, ly)
      .closePath()
      .stroke({
        width: (3.4 + glow * 2.4) * sc,
        color: neon,
        alpha: 0.42 + glow * 0.45
      });
  }
}

/** @deprecated 호환용 — 세로 블록 사용 */
export const drawBridgeIsoBlock = drawBridgeVerticalBlock;

/** 이전 메인 화면용 큐브 (픽존 UI 보조). */
export function drawIsoGlassPane(
  g: Graphics,
  cx: number,
  cy: number,
  scale: number,
  tint: number,
  opts: { glow?: number }
): void {
  const glow = opts.glow ?? 0;
  const w = 44 * scale;
  const skew = 20 * scale;
  const hb = 8 * scale;
  const ht = 15 * scale;
  const a = 0.28 + glow * 0.34;
  const p0x = cx - w * 0.5 + skew;
  const p0y = cy - ht;
  const p1x = cx + w * 0.5 + skew * 1.06;
  const p1y = cy - ht * 0.88;
  const p2x = cx + w * 0.45 - skew * 0.35;
  const p2y = cy + hb;
  const p3x = cx - w * 0.45 - skew * 1.02;
  const p3y = cy + hb * 0.88;
  g.moveTo(p0x, p0y)
    .lineTo(p1x, p1y)
    .lineTo(p2x, p2y)
    .lineTo(p3x, p3y)
    .closePath()
    .fill({ color: tint, alpha: a })
    .stroke({ width: 1.1 + glow * 2.4, color: 0xffffff, alpha: 0.18 + glow * 0.55 });
}

export function drawGlassShards(g: Graphics, cx: number, cy: number, scale: number, seed: number, brokenPulse: number): void {
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + seed * 0.11;
    const rx = (8 + (i % 3) * 5) * scale;
    const ry = (4 + (i % 2) * 3) * scale;
    const ox = Math.cos(ang) * 6 * scale + Math.sin(seed + i * 13) * 2;
    const oy = Math.sin(ang) * 4 * scale;
    g.ellipse(cx + ox, cy + oy, rx * 0.7, ry * 0.5).fill({
      color: 0xffffff,
      alpha: 0.07 + brokenPulse * 0.1 + i * 0.02
    });
  }
}

export function drawCrackBurst(g: Graphics, cx: number, cy: number, scale: number, t: number): void {
  const rays = 5;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI + 0.35;
    const len = (16 + 20 * (1 - t)) * scale;
    g.moveTo(cx, cy)
      .lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
      .stroke({ width: 2.1 * (1 - t * 0.52), color: 0xffffff, alpha: 0.62 * (1 - t) });
  }
}

/** 2D 사이드뷰 유리 판. */
export function drawSideGlassSlab(
  g: Graphics,
  cx: number,
  cy: number,
  w: number,
  hTot: number,
  tintRaw: number,
  opts: { glow?: number }
): void {
  const glow = opts.glow ?? 0;
  const a = 0.31 + glow * 0.4;
  g.roundRect(cx - w / 2, cy - hTot / 2, w, hTot, Math.min(w, hTot) * 0.38)
    .fill({ color: tintRaw >>> 0, alpha: a })
    .stroke({ width: 1.2 + glow * 4, color: 0xffffff, alpha: 0.2 + glow * 0.78 });
}

export function drawSideGlassShards(g: Graphics, cx: number, cy: number, w: number, seed: number): void {
  for (let i = 0; i < 9; i++) {
    const xo = (((seed * (i + 3)) >> 4) % 22) - 11;
    const yo = (((seed * i) >> 2) % 14) - 7;
    g.roundRect(
      cx + xo - 10,
      cy + yo + 8,
      Math.max(3, ((i * 17) % 11) + 4),
      Math.max(2, ((i * 11) % 9) + 2),
      1
    ).fill({ color: 0xffffff, alpha: 0.09 + ((i % 4) / 120) });
  }
  const hullW = Math.max(w, 28);
  g.roundRect(cx - hullW * 0.55, cy - 64, hullW * 1.08, 128, hullW * 0.08).stroke({
    width: 1.9,
    color: 0xff3355,
    alpha: 0.36
  });
}
