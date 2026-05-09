import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { CLIENT_GOAL_FLOOR } from "../../../config/climbConfig";
import { useHudStore } from "../../../state/hudStore";
import { useT } from "../useT";
import styles from "./ClimbHud.module.css";

const FAIL_ENERGY_STAGE_THRESHOLDS = [0, 180, 600] as const;

function failEnergyProgress(failEnergy: number): number {
  const energy = Math.max(0, failEnergy);
  for (let i = 1; i < FAIL_ENERGY_STAGE_THRESHOLDS.length; i++) {
    const prev = FAIL_ENERGY_STAGE_THRESHOLDS[i - 1]!;
    const next = FAIL_ENERGY_STAGE_THRESHOLDS[i]!;
    if (energy < next) return Math.max(0, Math.min(1, (energy - prev) / (next - prev)));
  }
  return 1;
}

/** 리스폰 카운트다운만 100ms 주기로 갱신 (다른 부분은 store 변화에만 반응) */
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
  const wait = useRespawnWait(model.respawnAvailableAt);

  const fillPct = `${failEnergyProgress(model.failEnergy) * 100}%`;
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
      <div className={styles.energyLabel}>{t("hud.failEnergyLabel")}</div>
      <div className={styles.energyBar}>
        <div className={styles.energyFill} style={{ width: fillPct }} />
      </div>
      <div className={styles.status}>{messages.join("\n")}</div>
    </div>
  );
}
