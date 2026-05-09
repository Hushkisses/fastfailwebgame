/** 닉네임 입력 후 접속 — Colyseus join 전까지 게임 초기화를 막음. */
export function openNicknameGate(opts: {
  overlayParent: HTMLElement;
  introTitle?: string;
  onJoin: (nickname: string) => void | Promise<void>;
  /** (선택) 서버 없이 단독 플레이 — 버튼이 추가되어 활성화된다 */
  onSolo?: (nickname: string) => void | Promise<void>;
}): () => void {
  const veil = document.createElement("div");
  veil.style.cssText =
    "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,rgba(180,210,245,0.55),rgba(243,245,249,0.96));font-family:system-ui,sans-serif";

  const card = document.createElement("div");
  card.style.cssText =
    "width:min(420px,calc(100vw - 32px));padding:28px 26px;background:#ffffff;border:1px solid rgba(26,143,216,0.35);border-radius:14px;box-shadow:0 18px 48px rgba(20,40,80,0.18)";

  const h1 = document.createElement("h1");
  h1.textContent = opts.introTitle ?? "유리 다리 접속";
  h1.style.cssText = "margin:0 0 8px;font-size:21px;color:#0d1422;font-weight:800";

  const sub = document.createElement("p");
  sub.textContent =
    "닉네임은 다리 위에 다른 플레이어에게 실시간으로 표시됩니다. (공백·특문 자동 축약)";
  sub.style.cssText =
    "margin:0 0 18px;font-size:13px;line-height:1.45;color:#445064";

  const label = document.createElement("label");
  label.textContent = "플레이어 닉네임";
  label.style.display = "block";
  label.style.marginBottom = "6px";
  label.style.fontSize = "12px";
  label.style.fontWeight = "700";
  label.style.color = "#2a3344";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "예: 낙순이";
  input.maxLength = 18;
  input.autocomplete = "username";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:16px;font-size:16px;border-radius:10px;border:1px solid #c2cfe0;background:#f8fafd;color:#0d1422";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px";

  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "접속";
  go.style.cssText =
    "flex:1;padding:14px;font-size:15px;font-weight:800;border-radius:11px;border:none;cursor:pointer;background:linear-gradient(135deg,#1a8fd8,#3ab5ee);color:#ffffff;box-shadow:0 4px 10px rgba(26,143,216,0.35)";

  const solo = document.createElement("button");
  solo.type = "button";
  solo.textContent = "단독 플레이";
  solo.style.cssText =
    "flex:0 0 auto;padding:14px 16px;font-size:13px;font-weight:700;border-radius:11px;border:1px solid #c2cfe0;background:#ffffff;color:#2a3344;cursor:pointer";
  solo.style.display = opts.onSolo ? "block" : "none";

  const tip = document.createElement("div");
  tip.style.cssText = "margin-top:14px;font-size:11px;color:#7080a0;line-height:1.4";

  tip.textContent = "Enter 또는 접속 버튼으로 진입합니다.";

  const errorBox = document.createElement("div");
  errorBox.style.cssText =
    "margin-top:14px;padding:10px 12px;border-radius:9px;border:1px solid #e09090;background:#fff0f0;color:#a02020;font-size:12px;font-weight:600;line-height:1.45;display:none";
  errorBox.setAttribute("role", "alert");

  const cleanup = (): void => {
    veil.remove();
  };

  const showError = (msg: string): void => {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  };

  const submit = async (): Promise<void> => {
    const raw = input.value.trim();
    const sanitized = sanitizeNickname(raw || `Player-${Math.floor(Math.random() * 99999)}`);
    input.disabled = true;
    go.disabled = true;
    solo.disabled = true;
    errorBox.style.display = "none";
    try {
      await opts.onJoin(sanitized);
      cleanup();
    } catch (e) {
      input.disabled = false;
      go.disabled = false;
      solo.disabled = false;
      showError(
        "게임 서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 단독 플레이를 이용하세요. (서버가 켜져 있는지 확인해 주세요)"
      );
      console.warn("[loginGate] connect failed", e);
    }
  };

  const submitSolo = async (): Promise<void> => {
    if (!opts.onSolo) return;
    const raw = input.value.trim();
    const sanitized = sanitizeNickname(raw || `Solo-${Math.floor(Math.random() * 9999)}`);
    input.disabled = true;
    go.disabled = true;
    solo.disabled = true;
    errorBox.style.display = "none";
    try {
      await opts.onSolo(sanitized);
      cleanup();
    } catch (e) {
      input.disabled = false;
      go.disabled = false;
      solo.disabled = false;
      showError("단독 플레이 시작에 실패했습니다.");
      console.warn("[loginGate] solo failed", e);
    }
  };

  go.onclick = () => void submit();
  solo.onclick = () => void submitSolo();
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") void submit();
  });

  row.append(go);
  if (opts.onSolo) row.append(solo);
  card.append(h1, sub, label, input, row, tip, errorBox);
  veil.append(card);
  opts.overlayParent.append(veil);
  queueMicrotask(() => input.focus());

  return cleanup;
}

function sanitizeNickname(s: string): string {
  let t = s.trim().slice(0, 18).replace(/\s+/g, " ");
  t = t.replace(/[<>'"&|\\]/g, "");
  return t.length ? t.slice(0, 18) : "플레이어";
}
