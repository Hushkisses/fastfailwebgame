import type { ReactElement } from "react";
import type { Locale } from "../../i18n";
import { useHudStore } from "../../state/hudStore";
import { AdminPanel } from "./AdminPanel/AdminPanel";
import { ClimbHud } from "./ClimbHud/ClimbHud";
import { HintBar } from "./HintBar/HintBar";
import { MultiRoundBanner } from "./MultiRoundBanner/MultiRoundBanner";
import { NicknameGate } from "./NicknameGate/NicknameGate";
import { SoloBadge } from "./SoloBadge/SoloBadge";

export interface AppProps {
  onJoin: (nickname: string, locale: Locale) => Promise<void> | void;
  onSolo: (nickname: string, locale: Locale) => Promise<void> | void;
  onAdminSession?: (password: string, locale: Locale) => Promise<void> | void;
}

/**
 * React HUD 트리.
 * - gate: <NicknameGate />
 * - admin: <AdminPanel />
 * - solo/multi: <ClimbHud /> + <HintBar /> (+ solo면 <SoloBadge />)
 */
export function App({ onJoin, onSolo, onAdminSession }: AppProps): ReactElement | null {
  const mode = useHudStore((s) => s.mode);
  const inGame = mode === "solo" || mode === "multi";

  return (
    <>
      {mode === "gate" && (
        <NicknameGate onJoin={onJoin} onSolo={onSolo} onAdminSession={onAdminSession} />
      )}
      {mode === "admin" && <AdminPanel />}
      {mode === "solo" && <SoloBadge />}
      {mode === "multi" && <MultiRoundBanner />}
      {inGame && <ClimbHud />}
      {inGame && <HintBar />}
    </>
  );
}
