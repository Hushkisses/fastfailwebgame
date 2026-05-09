import type { ReactElement } from "react";
import { useT } from "../useT";
import styles from "./SoloBadge.module.css";

export function SoloBadge(): ReactElement {
  const t = useT();
  return <div className={styles.badge}>{t("solo.badge")}</div>;
}
