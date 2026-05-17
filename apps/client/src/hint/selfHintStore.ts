import type { HintFlash } from "./collectHints";

let active: HintFlash | null = null;

export function applySelfHintGranted(
  msg: {
    floor?: number;
    safeSide?: string;
    expiresAt?: number;
  },
  selfSessionId: string,
  nickname: string
): void {
  const floor = typeof msg.floor === "number" ? msg.floor : Number(msg.floor ?? 1);
  const expiresAt = typeof msg.expiresAt === "number" ? msg.expiresAt : Number(msg.expiresAt ?? 0);
  const safeSide = msg.safeSide === "right" ? "right" : "left";
  if (!Number.isFinite(floor) || !Number.isFinite(expiresAt)) return;

  active = {
    playerId: selfSessionId,
    nickname,
    floor,
    safeSide,
    expiresAt
  };
}

export function getSelfActiveHints(): HintFlash[] {
  if (!active) return [];
  if (Date.now() >= active.expiresAt) {
    active = null;
    return [];
  }
  return [active];
}

export function clearSelfHints(): void {
  active = null;
}
