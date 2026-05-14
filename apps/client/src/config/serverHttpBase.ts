/** `VITE_SERVER_URL`(ws)과 동일 호스트의 HTTP API 베이스 (관리자 메타 등). */
export function serverHttpBaseFromEnv(): string {
  const ws = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
  try {
    const u = new URL(ws);
    const protocol = u.protocol === "wss:" ? "https:" : "http:";
    return `${protocol}//${u.host}`;
  } catch {
    return "http://localhost:2567";
  }
}
