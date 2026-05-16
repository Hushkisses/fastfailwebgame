import type { Room } from "colyseus.js";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { t as rawT, type Locale } from "../../../i18n";
import { useHudStore } from "../../../state/hudStore";
import { StatScatterGrid } from "./StatScatterGrid";
import type { NumericStatKey } from "./statScatter";
import type { StatRowView } from "./statTypes";
import styles from "./AdminPanel.module.css";

export type StatSortKey = "rank" | "name" | "failCount" | "bestFloor" | "currentFloor";
export type StatSortDir = "asc" | "desc";

function readStatsFromState(state: unknown): StatRowView[] {
  const s = state as Record<string, unknown> | null;
  const list = s?.lastRoundStats as { length?: number; [i: number]: unknown } | undefined;
  if (!list || typeof list.length !== "number" || list.length <= 0) return [];

  const rows: StatRowView[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] as Record<string, unknown> | undefined;
    if (!raw) continue;
    const bestFloorReached =
      typeof raw.bestFloorReached === "number" ? raw.bestFloorReached : Number(raw.bestFloorReached ?? 0);
    const rankRaw = typeof raw.rank === "number" ? raw.rank : Number(raw.rank ?? 0);
    const failCount = typeof raw.failCount === "number" ? raw.failCount : Number(raw.failCount ?? 0);
    const currentFloorRaw =
      typeof raw.currentFloor === "number" ? raw.currentFloor : Number(raw.currentFloor ?? NaN);
    const currentFloor = Number.isFinite(currentFloorRaw) ? currentFloorRaw : bestFloorReached;
    const failEnergy =
      typeof raw.failEnergy === "number" ? raw.failEnergy : Number(raw.failEnergy ?? 0);
    rows.push({
      name: String(raw.name ?? ""),
      rank: rankRaw > 0 ? rankRaw : i + 1,
      failCount,
      bestFloorReached,
      currentFloor,
      failEnergy
    });
  }
  return rows;
}

function defaultSortDir(key: StatSortKey): StatSortDir {
  if (key === "rank" || key === "name" || key === "failCount") return "asc";
  return "desc";
}

function compareRows(a: StatRowView, b: StatRowView, key: StatSortKey, dir: StatSortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "name") {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * sign;
  }
  const va =
    key === "rank"
      ? a.rank
      : key === "failCount"
        ? a.failCount
        : key === "currentFloor"
          ? a.currentFloor
          : a.bestFloorReached;
  const vb =
    key === "rank"
      ? b.rank
      : key === "failCount"
        ? b.failCount
        : key === "currentFloor"
          ? b.currentFloor
          : b.bestFloorReached;
  if (va !== vb) return (va - vb) * sign;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function readPhase(state: unknown): string {
  const s = state as Record<string, unknown> | null;
  const p = s?.matchPhase;
  if (p === "waiting" || p === "playing" || p === "ended") return p;
  return "waiting";
}

/** `players` 맵에 올라간 실제 플레이어 수(관리자 클라이언트는 제외). */
function countPlayersInRoom(state: unknown): number {
  const s = state as Record<string, unknown> | null;
  const players = s?.players as
    | { size?: number; forEach?: (cb: (value: unknown, key: string) => void) => void }
    | undefined;
  if (!players || typeof players !== "object") return 0;
  if (typeof players.size === "number") return players.size;
  let n = 0;
  players.forEach?.(() => {
    n += 1;
  });
  return n;
}

export function AdminPanel(): ReactElement | null {
  const locale = useHudStore((s) => s.locale) as Locale;
  const room = useHudStore((s) => s.adminRoom);
  const setMode = useHudStore((s) => s.setMode);
  const setAdminRoom = useHudStore((s) => s.setAdminRoom);
  const t = (key: string, vars?: Record<string, string | number>): string => rawT(locale, key, vars);

  const [sortKey, setSortKey] = useState<StatSortKey>("rank");
  const [sortDir, setSortDir] = useState<StatSortDir>("asc");

  const [bump, setBump] = useState(0);
  const forceUpdate = useCallback((): void => {
    setBump((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!room) return;
    const cr = room as unknown as Room;
    const onChange = (): void => {
      forceUpdate();
    };
    cr.onStateChange(onChange);
    return () => {
      cr.onStateChange.remove(onChange);
    };
  }, [room, forceUpdate]);

  const phase = room ? readPhase(room.state) : "waiting";
  const connectedPlayerCount = useMemo(() => {
    if (!room) return 0;
    return countPlayersInRoom(room.state);
  }, [room, phase, bump]);

  const sortedStats = useMemo(() => {
    if (!room) return [];
    const rows = readStatsFromState(room.state);
    if (rows.length === 0) return rows;
    const copy = [...rows];
    copy.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return copy;
  }, [room, sortKey, sortDir, phase, bump]);

  const toggleSort = (key: StatSortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  };

  const sortArrow = (key: StatSortKey): string => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const axisLabel = (key: NumericStatKey): string => {
    switch (key) {
      case "rank":
        return t("admin.colRank");
      case "failCount":
        return t("admin.colFailCount");
      case "bestFloorReached":
        return t("admin.colBest");
      case "currentFloor":
        return t("admin.colCurrentFloor");
      case "failEnergy":
        return t("admin.colEnergy");
    }
  };

  const pairTitle = (xKey: NumericStatKey, yKey: NumericStatKey): string =>
    t("admin.scatterPairTitle", { x: axisLabel(xKey), y: axisLabel(yKey) });

  const rawStats = useMemo(() => {
    if (!room) return [];
    return readStatsFromState(room.state);
  }, [room, phase, bump]);

  if (!room) {
    return null;
  }

  const leave = async (): Promise<void> => {
    const r = room as unknown as { leave?: (code?: number) => Promise<void> };
    try {
      await r.leave?.();
    } catch {
      /* noop */
    }
    setAdminRoom(null);
    setMode("gate");
  };

  return (
    <div className={styles.veil}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("admin.title")}</h1>
        <p className={styles.phase}>
          {t("admin.phase")}:{" "}
          {phase === "ended"
            ? t("admin.phaseEnded")
            : phase === "playing"
              ? t("admin.phasePlaying")
              : t("admin.phaseWaiting")}
        </p>
        <p className={styles.connected}>
          {phase === "waiting"
            ? t("admin.waitingPlayerCount", { count: connectedPlayerCount })
            : t("admin.connectedPlayerCount", { count: connectedPlayerCount })}
        </p>

        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => room.send("adminStart")}
          >
            {t("admin.startRound")}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => room.send("adminEnd")}
          >
            {t("admin.endRound")}
          </button>
        </div>

        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => void leave()}>
            {t("admin.backToLobby")}
          </button>
        </div>

        <h2 className={styles.statsTitle}>{t("admin.statsTitle")}</h2>
        <p className={styles.sortHint}>{t("admin.statsSortHint")}</p>
        {phase === "ended" && sortedStats.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={`${styles.th} ${styles.thNum}`}>
                    <button type="button" className={styles.thBtn} onClick={() => toggleSort("rank")}>
                      {t("admin.colRank")}
                      {sortArrow("rank")}
                    </button>
                  </th>
                  <th className={styles.th}>
                    <button type="button" className={styles.thBtn} onClick={() => toggleSort("name")}>
                      {t("admin.colName")}
                      {sortArrow("name")}
                    </button>
                  </th>
                  <th className={`${styles.th} ${styles.thNum}`}>
                    <button type="button" className={styles.thBtn} onClick={() => toggleSort("failCount")}>
                      {t("admin.colFailCount")}
                      {sortArrow("failCount")}
                    </button>
                  </th>
                  <th className={`${styles.th} ${styles.thNum}`}>
                    <button type="button" className={styles.thBtn} onClick={() => toggleSort("bestFloor")}>
                      {t("admin.colBest")}
                      {sortArrow("bestFloor")}
                    </button>
                  </th>
                  <th className={`${styles.th} ${styles.thNum}`}>
                    <button type="button" className={styles.thBtn} onClick={() => toggleSort("currentFloor")}>
                      {t("admin.colCurrentFloor")}
                      {sortArrow("currentFloor")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((row, i) => (
                  <tr key={`${row.name}-${row.rank}-${i}`}>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.rank}</td>
                    <td className={styles.td}>{row.name}</td>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.failCount}</td>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.bestFloorReached}</td>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.currentFloor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>
            {phase === "ended" && sortedStats.length === 0
              ? t("admin.statsNoPlayers")
              : t("admin.statsEmpty")}
          </p>
        )}

        {phase === "ended" && rawStats.length > 0 && (
          <StatScatterGrid
            rows={rawStats}
            axisLabel={axisLabel}
            pairTitle={pairTitle}
            sectionTitle={t("admin.scatterSectionTitle")}
            sectionHint={t("admin.scatterSortHint")}
            showAllLabel={t("admin.scatterShowAll")}
            showLessLabel={t("admin.scatterShowLess")}
            legendConservative={t("admin.scatterLegendConservative")}
            legendBold={t("admin.scatterLegendBold")}
            legendOther={t("admin.scatterLegendOther")}
          />
        )}

        <p className={styles.tip}>{t("admin.tip")}</p>
      </div>
    </div>
  );
}
