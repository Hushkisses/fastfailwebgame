import { useCallback } from "react";
import { t } from "../../i18n";
import { useHudStore } from "../../state/hudStore";

/** Store의 locale에 자동 바인딩된 i18n 함수. locale 변경 시 자동 재구독. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = useHudStore((s) => s.locale);
  return useCallback((key, vars) => t(locale, key, vars), [locale]);
}
