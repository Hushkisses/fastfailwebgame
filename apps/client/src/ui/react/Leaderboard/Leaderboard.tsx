import type { ReactElement } from "react";
import { useMemo } from "react";
import { useHudStore } from "../../../state/hudStore";
import { useT } from "../useT";
import styles from "./Leaderboard.module.css";
export type { BoardRow } from "./boardTypes";

/**
 * 우상단 1위 패널 — 잡다 정보 제거.
 * 현재 1위 닉네임과 그 사람이 도달한 최고 층만 표시.
 */
export function Leaderboard(): ReactElement {
  const t = useT();
  const rows = useHudStore((s) => s.leaderRows);
  const selfId = useHudStore((s) => s.selfSessionId);

  const top = useMemo(() => {
    if (!rows.length) return null;
    return [...rows].sort((a, b) => {
      if (b.bestFloor !== a.bestFloor) return b.bestFloor - a.bestFloor;
      if (b.failEnergy !== a.failEnergy) return b.failEnergy - a.failEnergy;
      return a.name.localeCompare(b.name);
    })[0]!;
  }, [rows]);

  const isYou = top !== null && top.id === selfId;

  return (
    <aside className={styles.panel}>
      <div className={styles.label}>{t("leaderboard.rankOne")}</div>
      <div className={isYou ? styles.nameSelf : styles.name}>
        {top === null ? "—" : isYou ? `${top.name} (${t("leaderboard.you")})` : top.name}
      </div>
      <div className={styles.floor}>
        {top === null ? "" : t("leaderboard.bestFloor", { floor: top.bestFloor })}
      </div>
    </aside>
  );
}
