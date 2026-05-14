import type { ReactElement } from "react";
import { t as rawT, type Locale } from "../../../i18n";
import { useHudStore } from "../../../state/hudStore";
import styles from "./MultiRoundBanner.module.css";

export function MultiRoundBanner(): ReactElement | null {
  const mode = useHudStore((s) => s.mode);
  const phase = useHudStore((s) => s.multiMatchPhase);
  const locale = useHudStore((s) => s.locale) as Locale;

  if (mode !== "multi" || phase === "playing") {
    return null;
  }

  const t = (key: string): string => rawT(locale, key);
  const msg = phase === "ended" ? t("lobby.multiRoundEnded") : t("lobby.multiWaitAdmin");
  const cls =
    phase === "ended" ? `${styles.banner} ${styles.ended}` : `${styles.banner} ${styles.waiting}`;

  return <div className={cls}>{msg}</div>;
}
