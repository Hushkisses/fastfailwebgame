import type { ReactElement } from "react";
import type { Locale } from "../../i18n";
import { useHudStore } from "../../state/hudStore";
import { ClimbHud } from "./ClimbHud/ClimbHud";
import { HintBar } from "./HintBar/HintBar";
import { Leaderboard } from "./Leaderboard/Leaderboard";
import { NicknameGate } from "./NicknameGate/NicknameGate";
import { SoloBadge } from "./SoloBadge/SoloBadge";

export interface AppProps {
  onJoin: (nickname: string, locale: Locale) => Promise<void> | void;
  onSolo: (nickname: string, locale: Locale) => Promise<void> | void;
}

/**
 * React HUD 트리.
 * - gate: <NicknameGate />
 * - solo/multi: <ClimbHud /> + <Leaderboard /> + <HintBar /> (+ solo면 <SoloBadge />)
 */
export function App({ onJoin, onSolo }: AppProps): ReactElement | null {
  const mode = useHudStore((s) => s.mode);
  const inGame = mode === "solo" || mode === "multi";

  return (
    <>
      {mode === "gate" && <NicknameGate onJoin={onJoin} onSolo={onSolo} />}
      {mode === "solo" && <SoloBadge />}
      {inGame && <ClimbHud />}
      {inGame && <Leaderboard />}
      {inGame && <HintBar />}
    </>
  );
}
