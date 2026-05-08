import { Graphics } from "pixi.js";

/** UI 큐브: `drawTile(x, y, height, color)`. */
export function drawTile(g: Graphics, x: number, y: number, height: number, topRgb: number): void {
  const hw = 38;
  const hh = 19;
  const wall = 14;
  const lift = height * 10;
  const cy = y - lift;

  const leftShade = shade(topRgb, 0.58);
  const rightShade = shade(topRgb, 0.46);
  const topShade = shade(topRgb, 1);

  g.moveTo(x - hw, cy)
    .lineTo(x, cy + hh)
    .lineTo(x + 5, cy + hh + wall)
    .lineTo(x - hw - 3, cy + wall * 0.62)
    .closePath()
    .fill(leftShade);

  g.moveTo(x + hw, cy)
    .lineTo(x, cy + hh)
    .lineTo(x - 5, cy + hh + wall)
    .lineTo(x + hw + 3, cy + wall * 0.62)
    .closePath()
    .fill(rightShade);

  g.moveTo(x, cy - hh)
    .lineTo(x + hw, cy)
    .lineTo(x, cy + hh)
    .lineTo(x - hw, cy)
    .closePath()
    .fill(topShade)
    .stroke({ color: 0x1a1f2e, width: 1 });
}

export function shade(hex: number, m: number): number {
  const r = Math.min(255, Math.floor((((hex >> 16) & 255) * m)));
  const g = Math.min(255, Math.floor((((hex >> 8) & 255) * m)));
  const b = Math.min(255, Math.floor(((hex & 255) * m)));
  return (r << 16) | (g << 8) | b;
}
