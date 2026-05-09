import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { ensureAudio } from "../../../audio/themePad";
import { useHudStore } from "../../../state/hudStore";
import { useT } from "../useT";
import styles from "./HintBar.module.css";

/**
 * 힌트 요청 버튼 + 안내 팁.
 * 서버가 hintRejected 메시지로 nextAt 을 주면 store.hintCooldownUntil 가 갱신되고,
 * 그 시점부터 쿨다운 끝(or 최대 5.5s)까지 버튼 라벨이 "wait Xs" 로 잠시 변한다.
 */
export function HintBar(): ReactElement {
  const t = useT();
  const onRequestHint = useHudStore((s) => s.onRequestHint);
  const hintCooldownUntil = useHudStore((s) => s.hintCooldownUntil);
  const setHintCooldownUntil = useHudStore((s) => s.setHintCooldownUntil);

  /** hintRejected 도착 직후 캡쳐된 wait 초. 5.5s 또는 wait 만료 후 0으로 리셋 */
  const [snapshotWait, setSnapshotWait] = useState(0);

  useEffect(() => {
    if (!hintCooldownUntil) {
      setSnapshotWait(0);
      return;
    }
    const waitMs = Math.max(0, hintCooldownUntil - Date.now());
    setSnapshotWait(waitMs / 1000);
    if (waitMs <= 0) return;
    const id = window.setTimeout(() => {
      setSnapshotWait(0);
      setHintCooldownUntil(0);
    }, Math.min(waitMs, 5500));
    return () => window.clearTimeout(id);
  }, [hintCooldownUntil, setHintCooldownUntil]);

  const label =
    snapshotWait > 0
      ? t("hint.wait", { seconds: snapshotWait.toFixed(1) })
      : t("hint.button");

  const handleClick = (): void => {
    onRequestHint();
    ensureAudio();
  };

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.button} onClick={handleClick}>
        {label}
      </button>
      <div className={styles.tip}>{t("hint.tip")}</div>
    </div>
  );
}
