import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { locales, setStoredLocale, t as rawT, type Locale } from "../../../i18n";
import { useHudStore } from "../../../state/hudStore";
import styles from "./NicknameGate.module.css";

export interface NicknameGateProps {
  onJoin: (nickname: string, locale: Locale) => Promise<void> | void;
  onSolo?: (nickname: string, locale: Locale) => Promise<void> | void;
}

function sanitizeNickname(s: string, fallback: string): string {
  let v = s.trim().slice(0, 18).replace(/\s+/g, " ");
  v = v.replace(/[<>'"&|\\]/g, "");
  return v.length ? v.slice(0, 18) : fallback;
}

export function NicknameGate({ onJoin, onSolo }: NicknameGateProps): ReactElement {
  const locale = useHudStore((s) => s.locale);
  const setLocale = useHudStore((s) => s.setLocale);
  const t = (key: string, vars?: Record<string, string | number>): string => rawT(locale, key, vars);

  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onLocaleChange = (next: Locale): void => {
    setLocale(next);
    setStoredLocale(next);
    setError(null);
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const fallback = `${t("lobby.defaultNickname")}-${Math.floor(Math.random() * 99999)}`;
      const sanitized = sanitizeNickname(nickname || fallback, t("lobby.defaultNickname"));
      setStoredLocale(locale);
      await onJoin(sanitized, locale);
    } catch (e) {
      setSubmitting(false);
      setError(t("lobby.connectError"));
      console.warn("[NicknameGate] connect failed", e);
    }
  };

  const submitSolo = async (): Promise<void> => {
    if (!onSolo) return;
    setSubmitting(true);
    setError(null);
    try {
      const fallback = `${t("lobby.defaultSoloNickname")}-${Math.floor(Math.random() * 9999)}`;
      const sanitized = sanitizeNickname(nickname || fallback, t("lobby.defaultSoloNickname"));
      setStoredLocale(locale);
      await onSolo(sanitized, locale);
    } catch (e) {
      setSubmitting(false);
      setError(t("lobby.soloError"));
      console.warn("[NicknameGate] solo failed", e);
    }
  };

  return (
    <div className={styles.veil}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("lobby.title")}</h1>
        <p className={styles.subtitle}>{t("lobby.subtitle")}</p>

        <label className={styles.label} htmlFor="gate-locale">
          {t("language.label")}
        </label>
        <select
          id="gate-locale"
          className={styles.select}
          value={locale}
          disabled={submitting}
          onChange={(ev) => onLocaleChange(ev.target.value as Locale)}
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {t(`language.${code}`)}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="gate-nickname">
          {t("lobby.nicknameLabel")}
        </label>
        <input
          id="gate-nickname"
          ref={inputRef}
          type="text"
          className={styles.input}
          maxLength={18}
          autoComplete="username"
          placeholder={t("lobby.nicknamePlaceholder")}
          value={nickname}
          disabled={submitting}
          onChange={(ev) => setNickname(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") void submit();
          }}
        />

        <div className={styles.row}>
          <button
            type="button"
            className={styles.joinButton}
            disabled={submitting}
            onClick={() => void submit()}
          >
            {t("lobby.join")}
          </button>
          {onSolo && (
            <button
              type="button"
              className={styles.soloButton}
              disabled={submitting}
              onClick={() => void submitSolo()}
            >
              {t("lobby.solo")}
            </button>
          )}
        </div>

        <div className={styles.tip}>{t("lobby.tip")}</div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
