import type { Room } from "colyseus.js";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { t as rawT, type Locale } from "../../../i18n";
import { useHudStore } from "../../../state/hudStore";
import styles from "./AdminPanel.module.css";

interface StatRowView {
  name: string;
  bestFloorReached: number;
  failEnergy: number;
  hasWon: boolean;
}

function readStatsFromState(state: unknown): StatRowView[] {
  const s = state as Record<string, unknown> | null;
  const list = s?.lastRoundStats as { length?: number; [i: number]: unknown } | undefined;
  if (!list || typeof list.length !== "number" || list.length <= 0) return [];

  const rows: StatRowView[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] as Record<string, unknown> | undefined;
    if (!raw) continue;
    rows.push({
      name: String(raw.name ?? ""),
      bestFloorReached:
        typeof raw.bestFloorReached === "number" ? raw.bestFloorReached : Number(raw.bestFloorReached ?? 0),
      failEnergy: typeof raw.failEnergy === "number" ? raw.failEnergy : Number(raw.failEnergy ?? 0),
      hasWon: Boolean(raw.hasWon)
    });
  }
  return rows;
}

function readPhase(state: unknown): string {
  const s = state as Record<string, unknown> | null;
  const p = s?.matchPhase;
  if (p === "waiting" || p === "playing" || p === "ended") return p;
  return "waiting";
}

export function AdminPanel(): ReactElement | null {
  const locale = useHudStore((s) => s.locale) as Locale;
  const room = useHudStore((s) => s.adminRoom);
  const setMode = useHudStore((s) => s.setMode);
  const setAdminRoom = useHudStore((s) => s.setAdminRoom);
  const t = (key: string, vars?: Record<string, string | number>): string => rawT(locale, key, vars);

  const [, setBump] = useState(0);
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

  if (!room) {
    return null;
  }

  const phase = readPhase(room.state);
  const stats = readStatsFromState(room.state);

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
        {phase === "ended" && stats.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>{t("admin.colName")}</th>
                  <th className={styles.th}>{t("admin.colBest")}</th>
                  <th className={styles.th}>{t("admin.colEnergy")}</th>
                  <th className={styles.th}>{t("admin.colWin")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row, i) => (
                  <tr key={`${row.name}-${i}`}>
                    <td className={styles.td}>{row.name}</td>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.bestFloorReached}</td>
                    <td className={`${styles.td} ${styles.tdNum}`}>{row.failEnergy}</td>
                    <td className={styles.td}>{row.hasWon ? t("admin.yes") : t("admin.no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>
            {phase === "ended" && stats.length === 0
              ? t("admin.statsNoPlayers")
              : t("admin.statsEmpty")}
          </p>
        )}

        <p className={styles.tip}>{t("admin.tip")}</p>
      </div>
    </div>
  );
}
