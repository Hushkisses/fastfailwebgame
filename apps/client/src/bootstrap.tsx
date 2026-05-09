import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, type AppProps } from "./ui/react/App";

/** React HUD 트리 진입점. main.ts 에서 호출. */
let mounted = false;
export function mountReactHud(props: AppProps): void {
  if (mounted) return;
  const host = document.getElementById("ui-root");
  if (!host) throw new Error("Missing #ui-root for React HUD");
  createRoot(host).render(
    <StrictMode>
      <App {...props} />
    </StrictMode>
  );
  mounted = true;
}
