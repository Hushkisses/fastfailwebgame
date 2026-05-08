import { Graphics } from "pixi.js";

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
