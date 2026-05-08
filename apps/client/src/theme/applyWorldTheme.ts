import { THEME_EVERY_FLOORS } from "../config/climbConfig";

/**
 * 거리두기 존 타일 테마처럼 배경 분위기 전환 (20층마다 한 단계).
 */
export function applyWorldTheme(currentFloor: number): void {
  const zone = Math.max(0, Math.floor(currentFloor / THEME_EVERY_FLOORS));
  const hue = (zone * 41 + 200) % 360;
  const hue2 = (hue + 55) % 360;
  document.body.style.background = [
    `radial-gradient(circle at 20% 20%, hsla(${hue},55%,26%,0.35), transparent 45%)`,
    `radial-gradient(circle at 80% 10%, hsla(${hue2},42%,22%,0.3), transparent 40%)`,
    `linear-gradient(160deg, hsl(${hue},28%,11%) 0%, hsl(${hue2},32%,8%) 100%)`
  ].join(",");
}
