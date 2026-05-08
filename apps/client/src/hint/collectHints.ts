export interface HintFlash {
  playerId: string;
  nickname: string;
  floor: number;
  safeSide: "left" | "right";
  expiresAt: number;
}

export type HintsCarrier = {
  hints?: {
    forEach(cb: (h: HintSchema, key: string) => void): void;
  };
};

type HintSchema = {
  floor: number | string;
  safeSide?: string;
  expiresAt?: number | string;
};

export function collectActiveHints(carrier: HintsCarrier | undefined, nameBySession: Map<string, string>): HintFlash[] {
  const raw: HintFlash[] = [];
  carrier?.hints?.forEach((hint, sid) => {
    const floor = typeof hint.floor === "number" ? hint.floor : Number(hint.floor ?? 1);
    const expiresAt =
      typeof hint.expiresAt === "number" ? hint.expiresAt : Number(hint.expiresAt ?? 0);
    const safeSide = hint.safeSide === "right" ? "right" : "left";
    raw.push({
      playerId: sid,
      nickname: nameBySession.get(sid) ?? sid.slice(0, 5),
      floor: Number.isFinite(floor) ? floor : 1,
      safeSide,
      expiresAt
    });
  });

  const now = Date.now();
  return raw.filter((h) => now < h.expiresAt && h.floor >= 1);
}
