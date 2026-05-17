import { RECENT_TILE_CHOICE_COUNT } from "../config/tileLaneColors";

export type TileChoiceSide = "left" | "right";

export function pushRecentTileChoices(
  current: readonly TileChoiceSide[],
  sides: readonly TileChoiceSide[]
): TileChoiceSide[] {
  if (sides.length === 0) return [...current];
  const next = [...current, ...sides];
  if (next.length <= RECENT_TILE_CHOICE_COUNT) return next;
  return next.slice(next.length - RECENT_TILE_CHOICE_COUNT);
}

export function recentChoicesEqual(a: readonly TileChoiceSide[], b: readonly TileChoiceSide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
