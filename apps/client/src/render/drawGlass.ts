import { Graphics } from "pixi.js";
import {
  SLAB_HALF_WIDTH,
  SLAB_LIP_DEPTH,
  SLAB_TOP_THICK,
  type ScrollSide
} from "./sidescrollLayout";
import { blendFogColor } from "./towerLayout";

/** ClimbStage 픽 박스 호환 */
export const ISO_EXT_FRONT_Y = SLAB_LIP_DEPTH;

/** Gunmetal / 콘크리트 베이스 */
const TOP_METAL_L = 0x4a5568;
const TOP_METAL_R = 0x585068;
const LIP_DARK = 0x1e2329;
const SIDE_DIM = 0x2a323c;

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
 * 공중 평판 슬래브 — **마름모/보석 형태 없음**.
 * 원근 사다리꼴 윗면 + 얇은 전면 립만 (실제 플랫폼).
 */
export function drawFloatingSlab(
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
    depthFade?: number;
  }
): void {
  const { fog, broken, glow, lane, neonPick = false } = opts;
  const sc = opts.scale ?? 1;
  const depthFade = opts.depthFade ?? 0;
  const laneT = lane === "right" ? 1 : 0;

  let topBase = mixRgb(TOP_METAL_L, TOP_METAL_R, laneT * 0.35);
  let lipC = LIP_DARK;
  let sideC = SIDE_DIM;

  if (broken) {
    const d = Math.min(1, fog + 0.42);
    topBase = blendFogColor(0x353d48, d);
    lipC = blendFogColor(0x151820, d);
    sideC = blendFogColor(0x202830, d);
  } else {
    topBase = blendFogColor(topBase, fog * 0.85);
    lipC = blendFogColor(lipC, fog);
    sideC = blendFogColor(sideC, fog);
  }

  const hwNear = SLAB_HALF_WIDTH * sc;
  const hwFar = hwNear * (0.5 + 0.08 * (1 - depthFade));
  const yBack = cy - SLAB_TOP_THICK * sc * 0.85;
  const yFront = cy + SLAB_TOP_THICK * sc * 0.95;

  const bodyA = Math.max(0.2, 1 - depthFade * 0.62);
  const nearBright = (1 - depthFade * 0.55) * (neonPick ? 1.15 : 1);

  const topAlpha = broken
    ? 0.36 * bodyA
    : Math.max(0.08, (0.42 + glow * 0.22) * bodyA * nearBright);

  /** 윗면 — 넓은 사다리꼴 (멀리 가장자리 좁음 = 깊이) */
  g.moveTo(cx - hwFar, yBack)
    .lineTo(cx + hwFar, yBack)
    .lineTo(cx + hwNear, yFront)
    .lineTo(cx - hwNear, yFront)
    .closePath()
    .fill({ color: topBase, alpha: topAlpha });

  /** 전면 립 — 얇은 가로대만 (두께 얇게) */
  const lip = SLAB_LIP_DEPTH * sc * Math.max(0.55, 1 - depthFade * 0.35);
  const lipTop = yFront;
  const lipBot = yFront + lip;

  fillQuad(
    g,
    cx - hwNear,
    lipTop,
    cx + hwNear,
    lipTop,
    cx + hwNear * 0.92,
    lipBot,
    cx - hwNear * 0.92,
    lipBot,
    { color: lipC, alpha: bodyA * 0.95 }
  );

  const edgeW = Math.max(5, 7 * sc);
  fillQuad(
    g,
    cx - hwNear,
    lipTop,
    cx - hwNear + edgeW,
    lipTop,
    cx - hwNear + edgeW * 0.85,
    lipBot,
    cx - hwNear,
    lipBot,
    { color: sideC, alpha: bodyA * 0.5 }
  );
  fillQuad(
    g,
    cx + hwNear - edgeW,
    lipTop,
    cx + hwNear,
    lipTop,
    cx + hwNear,
    lipBot,
    cx + hwNear - edgeW * 0.85,
    lipBot,
    { color: sideC, alpha: bodyA * 0.5 }
  );

  /** 상단 하이라이트 라인 (금속 모서리) */
  g.moveTo(cx - hwFar, yBack)
    .lineTo(cx + hwFar, yBack)
    .stroke({
      width: Math.max(0.8, 1.2 * sc),
      color: 0x8899aa,
      alpha: Math.max(0.06, 0.14 * (1 - depthFade * 0.7)) * bodyA
    });

  if (!broken && !neonPick) {
    const edge = lane === "left" ? 0x335566 : 0x554466;
    g.moveTo(cx - hwFar, yBack)
      .lineTo(cx + hwFar, yBack)
      .lineTo(cx + hwNear, yFront)
      .lineTo(cx - hwNear, yFront)
      .closePath()
      .stroke({
        width: Math.max(0.7, 1.0 * sc),
        color: edge,
        alpha: Math.max(0.05, 0.12 * (1 - depthFade * 0.55))
      });
  }

  if (neonPick && !broken) {
    const neon = lane === "left" ? 0x44ddff : 0xdd77ff;
    g.moveTo(cx - hwFar, yBack)
      .lineTo(cx + hwFar, yBack)
      .lineTo(cx + hwNear, yFront)
      .lineTo(cx - hwNear, yFront)
      .closePath()
      .stroke({
        width: (2.2 + glow * 2.8) * sc,
        color: neon,
        alpha: 0.35 + glow * 0.42
      });
    g.moveTo(cx - hwFar, yBack)
      .lineTo(cx + hwFar, yBack)
      .lineTo(cx + hwNear, yFront)
      .lineTo(cx - hwNear, yFront)
      .closePath()
      .stroke({
        width: (5 + glow * 4) * sc,
        color: neon,
        alpha: 0.1 + glow * 0.12
      });
  }
}

/** 호환: 기존 이름 → 평판 슬래브 */
export const drawBridgeVerticalBlock = drawFloatingSlab;
export const drawBridgeIsoBlock = drawFloatingSlab;

export function drawIsoGlassPane(
  g: Graphics,
  cx: number,
  cy: number,
  scale: number,
  tint: number,
  opts: { glow?: number }
): void {
  const glow = opts.glow ?? 0;
  const w = 52 * scale;
  const h = 96 * scale;
  const a = 0.28 + glow * 0.28;
  g.roundRect(cx - w / 2, cy - h / 2, w, h, 6).fill({ color: tint, alpha: a }).stroke({
    width: 1.2 + glow * 2,
    color: 0xffffff,
    alpha: 0.15 + glow * 0.35
  });
}

export function drawGlassShards(g: Graphics, cx: number, cy: number, scale: number, seed: number, brokenPulse: number): void {
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + seed * 0.11;
    const rx = (8 + (i % 3) * 5) * scale;
    const ry = (4 + (i % 2) * 3) * scale;
    const ox = Math.cos(ang) * 6 * scale + Math.sin(seed + i * 13) * 2;
    const oy = Math.sin(ang) * 4 * scale;
    g.ellipse(cx + ox, cy + oy, rx * 0.7, ry * 0.5).fill({
      color: 0xaabbcc,
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
  const a = 0.31 + glow * 0.35;
  g.roundRect(cx - w / 2, cy - hTot / 2, w, hTot, 8)
    .fill({ color: tintRaw >>> 0, alpha: a })
    .stroke({ width: 1.2 + glow * 3, color: 0xffffff, alpha: 0.15 + glow * 0.45 });
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
