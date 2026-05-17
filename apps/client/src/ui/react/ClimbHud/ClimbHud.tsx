import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { CLIENT_GOAL_FLOOR } from "../../../config/climbConfig";
import { useHudStore } from "../../../state/hudStore";
import { useT } from "../useT";
import { RecentTileStrip } from "./RecentTileStrip";
import styles from "./ClimbHud.module.css";

function useRespawnWait(respawnAvailableAt: number): number {
  const [wait, setWait] = useState(() => computeWait(respawnAvailableAt));
  useEffect(() => {
    setWait(computeWait(respawnAvailableAt));
    if (!respawnAvailableAt) return;
    const id = window.setInterval(() => {
      const w = computeWait(respawnAvailableAt);
      setWait(w);
      if (w <= 0) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [respawnAvailableAt]);
  return wait;
}

function computeWait(respawnAvailableAt: number): number {
  const now = Date.now();
  return respawnAvailableAt > now ? Math.ceil((respawnAvailableAt - now) / 100) / 10 : 0;
}

export function ClimbHud(): ReactElement {
  const t = useT();
  const model = useHudStore((s) => s.model);
  const recentTileChoices = useHudStore((s) => s.recentTileChoices);
  const showRecentTileStrip = useHudStore((s) => s.showRecentTileStrip);
  const wait = useRespawnWait(model.respawnAvailableAt);

  const titleText = [
    t("hud.currentFloor", { floor: model.floor }),
    t("hud.goalFloor", { floor: CLIENT_GOAL_FLOOR })
  ].join("\n");

  const messages = [
    model.hasWon ? t("hud.win") : "",
    wait > 0 ? t("hud.respawnWait", { seconds: wait }) : ""
  ].filter(Boolean);

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{titleText}</div>
      {showRecentTileStrip ? (
        <RecentTileStrip
          choices={recentTileChoices}
          label={t("hud.recentTilesLabel")}
          ariaLeft={t("hud.recentTileLeft")}
          ariaRight={t("hud.recentTileRight")}
          ariaEmpty={t("hud.recentTileEmpty")}
          ratioHint={t("hud.safeSideRatioHint")}
        />
      ) : null}
      <div className={styles.status}>{messages.join("\n")}</div>
    </div>
  );
}
