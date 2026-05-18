import { useMemo } from "react";
import { useHudStore } from "../../../state/hudStore";
import type { BoardRow } from "./boardTypes";

export function useTopLeader(): { top: BoardRow | null; isYou: boolean } {
  const rows = useHudStore((s) => s.leaderRows);
  const selfId = useHudStore((s) => s.selfSessionId);

  return useMemo(() => {
    if (!rows.length) return { top: null, isYou: false };
    const top = [...rows].sort((a, b) => {
      if (b.bestFloor !== a.bestFloor) return b.bestFloor - a.bestFloor;
      if (b.failEnergy !== a.failEnergy) return b.failEnergy - a.failEnergy;
      return a.name.localeCompare(b.name);
    })[0]!;
    return { top, isYou: top.id === selfId };
  }, [rows, selfId]);
}
