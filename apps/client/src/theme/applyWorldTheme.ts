import { THEME_EVERY_FLOORS } from "../config/climbConfig";

/**
 * 라이트 테마 — 흰 배경에 부드러운 색조 변화 (20층마다 한 단계).
 * 텍스트는 어두운 색이므로 배경은 항상 밝게 유지.
 */
export function applyWorldTheme(currentFloor: number): void {
  const zone = Math.max(0, Math.floor(currentFloor / THEME_EVERY_FLOORS));
  const hue = (zone * 41 + 200) % 360;
  const hue2 = (hue + 55) % 360;
  document.body.style.background = [
    `radial-gradient(circle at 20% 18%, hsla(${hue},70%,84%,0.55), transparent 48%)`,
    `radial-gradient(circle at 80% 8%, hsla(${hue2},65%,86%,0.45), transparent 42%)`,
    `linear-gradient(160deg, hsl(${hue},42%,96%) 0%, hsl(${hue2},38%,93%) 100%)`
  ].join(",");
  document.body.style.color = "#0d1422";
}
