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

/**
 * 라이트 테마 슬래브 — 밝은 배경 위에서 또렷한 다크 콘크리트/금속 발판.
 * 윗면(중간 톤, 빛 받는 면) → 앞면(어두운 톤) → 옆면(가장 어두움).
 * 흰 배경과의 대비로 발판이 또렷하게 떠 있는 느낌.
 */
const TOP_L = 0x6c7c92;
const TOP_R = 0x70688c;
const FRONT_L = 0x363f50;
const FRONT_R = 0x393346;
const SIDE_L = 0x1d2230;
const SIDE_R = 0x201926;
const EDGE_HI = 0xc6d4e6;
const UNDER_SHADOW = 0x05080c;

/** 레인 네온 — 라이트 배경에서도 또렷하게 보이는 진한 톤 */
const NEON_L = 0x1a8fd8;
const NEON_R = 0xa83cd8;

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
 * 공중 콘크리트 슬래브 — 두꺼운 3D 구조물.
 * 윗면(평행사변형) + 앞면(두꺼운 벽) + 옆면(레인 안쪽 바라보는 측면).
 * 어두운 공간에 떠 있는 실제 발판 느낌.
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
  /** 어느 쪽 옆면이 보이는지 — 플레이어(중앙) 쪽 면이 보이도록 */
  const sideXSign = lane === "left" ? 1 : -1;
  const neonLane = lane === "left" ? NEON_L : NEON_R;

  let topC = mixRgb(TOP_L, TOP_R, laneT);
  let frontC = mixRgb(FRONT_L, FRONT_R, laneT);
  let sideC = mixRgb(SIDE_L, SIDE_R, laneT);
  let edgeHi = EDGE_HI;

  if (broken) {
    const d = Math.min(1, fog + 0.42);
    topC = blendFogColor(0x3d4350, d);
    frontC = blendFogColor(0x252a32, d);
    sideC = blendFogColor(0x171b22, d);
    edgeHi = blendFogColor(0x556070, d);
  } else {
    topC = blendFogColor(topC, fog * 0.78);
    frontC = blendFogColor(frontC, fog * 0.85);
    sideC = blendFogColor(sideC, fog * 0.92);
    edgeHi = blendFogColor(edgeHi, fog * 0.55);
  }

  const hw = SLAB_HALF_WIDTH * sc;
  const topH = SLAB_TOP_THICK * sc;
  const lipH = SLAB_LIP_DEPTH * sc * Math.max(0.62, 1 - depthFade * 0.32);

  /** 윗면의 앞·뒤 가장자리 (관측자 시점에서 약간 위에서 내려다봄) */
  const yBack = cy - topH * 0.95;
  const yTop = cy + topH * 1.05;
  const yBot = yTop + lipH;

  /** 등각 가로 시프트 — 뒷쪽 모서리가 플레이어 반대쪽으로 밀림 = 옆면 노출 */
  const skewMag = topH * 1.55 * Math.max(0.45, 1 - depthFade * 0.4);
  const skewX = sideXSign * skewMag;

  /** 앞면 바닥의 약한 원근 수렴 */
  const hwBot = hw * (0.97 - depthFade * 0.04);

  const bodyA = Math.max(0.34, 1 - depthFade * 0.5);
  const nearBright = (1 - depthFade * 0.5) * (neonPick ? 1.12 : 1);

  const topAlpha = broken
    ? 0.55 * bodyA
    : Math.min(1.0, (0.95 + glow * 0.05) * bodyA * nearBright);
  const frontAlpha = broken ? 0.5 * bodyA : Math.min(1.0, 0.97 * bodyA);
  const sideAlpha = broken ? 0.46 * bodyA : Math.min(1.0, 0.94 * bodyA);

  /** 공중 부유감 — 슬래브 아래 어두운 그림자 타원 (이중 코어) */
  if (!broken) {
    const shY = yBot + lipH * 0.42;
    const shR = hw * (0.96 + 0.08 * (1 - depthFade));
    g.ellipse(cx + skewX * 0.32, shY, shR, lipH * 0.22).fill({
      color: 0x000000,
      alpha: 0.45 * bodyA
    });
    g.ellipse(cx + skewX * 0.32, shY, shR * 0.66, lipH * 0.13).fill({
      color: 0x000000,
      alpha: 0.36 * bodyA
    });
  }

  /** 슬래브 바로 아래 안개 기둥 — 심연으로 흩어지는 미스트 */
  if (!broken && depthFade < 0.7) {
    const mistA = (1 - depthFade) * 0.22 * bodyA;
    const mY1 = yBot + lipH * 0.55;
    const mY2 = yBot + lipH * 2.4;
    const mY3 = yBot + lipH * 4.0;
    g.ellipse(cx + skewX * 0.25, mY1, hw * 0.78, lipH * 0.22).fill({
      color: 0x070b14,
      alpha: mistA
    });
    g.ellipse(cx + skewX * 0.18, mY2, hw * 0.55, lipH * 0.18).fill({
      color: 0x040810,
      alpha: mistA * 0.7
    });
    g.ellipse(cx + skewX * 0.1, mY3, hw * 0.34, lipH * 0.14).fill({
      color: 0x02050a,
      alpha: mistA * 0.45
    });
  }

  /** ① 윗면 — 평행사변형 (등각: 뒷 모서리가 옆으로 밀림) */
  g.moveTo(cx - hw, yTop)
    .lineTo(cx + hw, yTop)
    .lineTo(cx + hw + skewX, yBack)
    .lineTo(cx - hw + skewX, yBack)
    .closePath()
    .fill({ color: topC, alpha: topAlpha });

  /** 윗면 유리 반사 — 비스듬한 밝은 띠 (천장 광원이 닿는 느낌) */
  if (!broken) {
    const reflA = 0.22 * bodyA * (1 - depthFade * 0.5);
    const refLPad = hw * 0.18;
    const refX1 = cx - hw + refLPad - skewX * 0.05;
    const refX2 = cx + hw * 0.55 + skewX * 0.85;
    const refY1 = yTop - topH * 0.05;
    const refY2 = yBack + topH * 0.32;
    g.moveTo(refX1, refY1)
      .lineTo(refX2, refY2)
      .stroke({
        width: Math.max(1.0, 1.6 * sc),
        color: 0xc8e0f4,
        alpha: reflA
      });
    g.moveTo(refX1 + hw * 0.08, refY1 + topH * 0.1)
      .lineTo(refX2 - hw * 0.04, refY2 - topH * 0.05)
      .stroke({
        width: Math.max(0.6, 0.9 * sc),
        color: 0xe0f0ff,
        alpha: reflA * 0.55
      });
  }

  /** ② 옆면 — 플레이어(중앙)쪽 측벽 (가장 어둡게) */
  const sx = sideXSign * hw;
  const sxBot = sideXSign * hwBot;
  g.moveTo(cx + sx, yTop)
    .lineTo(cx + sx + skewX, yBack)
    .lineTo(cx + sxBot + skewX * 0.92, yBack + lipH)
    .lineTo(cx + sxBot, yBot)
    .closePath()
    .fill({ color: sideC, alpha: sideAlpha });

  /** ③ 앞면 — 두꺼운 검푸른 금속 벽 */
  g.moveTo(cx - hw, yTop)
    .lineTo(cx + hw, yTop)
    .lineTo(cx + hwBot, yBot)
    .lineTo(cx - hwBot, yBot)
    .closePath()
    .fill({ color: frontC, alpha: frontAlpha });

  /** 앞면 상단 미세한 빛 띠 — 유리 모서리에 빛이 머무는 느낌 */
  if (!broken) {
    const topGlowH = lipH * 0.18;
    fillQuad(
      g,
      cx - hw * 0.98,
      yTop + 0.5,
      cx + hw * 0.98,
      yTop + 0.5,
      cx + hw * 0.98,
      yTop + topGlowH,
      cx - hw * 0.98,
      yTop + topGlowH,
      { color: 0x4a6a86, alpha: 0.22 * bodyA * (1 - depthFade * 0.5) }
    );
  }

  /** 앞면 수직 반사 띠 — 유리·금속 광택 (플레이어 반대편 가장자리) */
  if (!broken) {
    const reflX = lane === "left" ? cx + hw * 0.68 : cx - hw * 0.68;
    const reflW = hw * 0.05;
    fillQuad(
      g,
      reflX - reflW,
      yTop + lipH * 0.06,
      reflX + reflW,
      yTop + lipH * 0.06,
      reflX + reflW * 0.88,
      yBot - lipH * 0.08,
      reflX - reflW * 0.88,
      yBot - lipH * 0.08,
      { color: 0x6a8aa6, alpha: 0.16 * bodyA * (1 - depthFade * 0.55) }
    );
  }

  /** 앞면 하단 어두운 그라데이션 — 두께·밀도감 */
  if (!broken) {
    const shH = lipH * 0.4;
    fillQuad(
      g,
      cx - hwBot * 0.99,
      yBot - shH,
      cx + hwBot * 0.99,
      yBot - shH,
      cx + hwBot,
      yBot,
      cx - hwBot,
      yBot,
      { color: UNDER_SHADOW, alpha: 0.55 * bodyA }
    );
  }

  /** 윗면 뒷 모서리 — 빛이 닿는 가장 밝은 캐치라인 */
  g.moveTo(cx - hw + skewX, yBack)
    .lineTo(cx + hw + skewX, yBack)
    .stroke({
      width: Math.max(1.0, 1.6 * sc),
      color: edgeHi,
      alpha: Math.max(0.18, 0.42 * (1 - depthFade * 0.55)) * bodyA
    });

  /** 윗면-앞면 경계 — 모서리 강조 (밟을 수 있는 가장자리) */
  g.moveTo(cx - hw, yTop)
    .lineTo(cx + hw, yTop)
    .stroke({
      width: Math.max(1.3, 2.0 * sc),
      color: edgeHi,
      alpha: Math.max(0.28, 0.62 * (1 - depthFade * 0.5)) * bodyA
    });

  /** 앞면 하단 — 깊은 그림자 라인 */
  g.moveTo(cx - hwBot, yBot)
    .lineTo(cx + hwBot, yBot)
    .stroke({
      width: Math.max(1.5, 2.4 * sc),
      color: 0x000000,
      alpha: 0.58 * bodyA
    });

  /** 옆면 바깥 모서리 — 측면 윤곽 */
  g.moveTo(cx + sxBot, yBot)
    .lineTo(cx + sxBot + skewX * 0.92, yBack + lipH)
    .stroke({
      width: Math.max(1.1, 1.6 * sc),
      color: 0x000000,
      alpha: 0.5 * bodyA
    });
  g.moveTo(cx + sx + skewX, yBack)
    .lineTo(cx + sxBot + skewX * 0.92, yBack + lipH)
    .stroke({
      width: Math.max(0.9, 1.3 * sc),
      color: 0x000000,
      alpha: 0.4 * bodyA
    });

  /** 항시 레인 네온 — 윗면-앞면 경계의 은은한 에지 라이트 (SF 패널 느낌) */
  if (!broken && !neonPick) {
    g.moveTo(cx - hw, yTop)
      .lineTo(cx + hw, yTop)
      .stroke({
        width: Math.max(0.9, 1.4 * sc),
        color: neonLane,
        alpha: Math.max(0.18, 0.4 * (1 - depthFade * 0.55))
      });
    /** 앞면 하단 살짝 비치는 언더글로우 */
    g.moveTo(cx - hwBot * 0.94, yBot - 1)
      .lineTo(cx + hwBot * 0.94, yBot - 1)
      .stroke({
        width: Math.max(0.6, 1.0 * sc),
        color: neonLane,
        alpha: Math.max(0.08, 0.2 * (1 - depthFade * 0.65))
      });
    /** 윗면 뒷 모서리에도 얇게 */
    g.moveTo(cx - hw + skewX, yBack)
      .lineTo(cx + hw + skewX, yBack)
      .stroke({
        width: Math.max(0.5, 0.8 * sc),
        color: neonLane,
        alpha: Math.max(0.06, 0.16 * (1 - depthFade * 0.7))
      });
  }

  /** 픽 가능 슬롯 — 네온 외곽선 + 헤일로 (3면 모두 강조) */
  if (neonPick && !broken) {
    const neon = lane === "left" ? 0x1a8fd8 : 0xa83cd8;

    const haloW = (5.5 + glow * 5) * sc;
    const haloA = 0.13 + glow * 0.18;
    g.moveTo(cx - hw, yTop)
      .lineTo(cx + hw, yTop)
      .stroke({ width: haloW, color: neon, alpha: haloA });
    g.moveTo(cx - hw + skewX, yBack)
      .lineTo(cx + hw + skewX, yBack)
      .stroke({ width: haloW * 0.78, color: neon, alpha: haloA * 0.78 });

    const outW = (2.0 + glow * 2.0) * sc;
    const outA = 0.42 + glow * 0.4;

    g.moveTo(cx - hw, yTop)
      .lineTo(cx + hw, yTop)
      .lineTo(cx + hw + skewX, yBack)
      .lineTo(cx - hw + skewX, yBack)
      .closePath()
      .stroke({ width: outW, color: neon, alpha: outA });

    g.moveTo(cx - hw, yTop)
      .lineTo(cx + hw, yTop)
      .lineTo(cx + hwBot, yBot)
      .lineTo(cx - hwBot, yBot)
      .closePath()
      .stroke({ width: outW, color: neon, alpha: outA * 0.85 });

    g.moveTo(cx + sx, yTop)
      .lineTo(cx + sx + skewX, yBack)
      .lineTo(cx + sxBot + skewX * 0.92, yBack + lipH)
      .lineTo(cx + sxBot, yBot)
      .closePath()
      .stroke({ width: outW * 0.88, color: neon, alpha: outA * 0.75 });
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
