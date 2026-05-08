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
    "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,rgba(40,72,140,0.35),rgba(6,10,22,0.96));font-family:system-ui,sans-serif";

  const card = document.createElement("div");
  card.style.cssText =
    "width:min(420px,calc(100vw - 32px));padding:28px 26px;background:rgba(14,18,32,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:14px;box-shadow:0 28px 80px rgba(0,0,0,0.55)";

  const h1 = document.createElement("h1");
  h1.textContent = opts.introTitle ?? "유리 다리 접속";
  h1.style.cssText = "margin:0 0 8px;font-size:21px;color:#eef3ff;font-weight:700";

  const sub = document.createElement("p");
  sub.textContent =
    "닉네임은 다리 위에 다른 플레이어에게 실시간으로 표시됩니다. (공백·특문 자동 축약)";
  sub.style.cssText =
    "margin:0 0 18px;font-size:13px;line-height:1.45;color:rgba(238,247,255,0.7)";

  const label = document.createElement("label");
  label.textContent = "플레이어 닉네임";
  label.style.display = "block";
  label.style.marginBottom = "6px";
  label.style.fontSize = "12px";
  label.style.opacity = "0.85";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "예: 낙순이";
  input.maxLength = 18;
  input.autocomplete = "username";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:16px;font-size:16px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:#090d18;color:#f4fbff";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px";

  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "접속";
  go.style.cssText =
    "flex:1;padding:14px;font-size:15px;font-weight:700;border-radius:11px;border:none;cursor:pointer;background:linear-gradient(135deg,#4b8dff,#74d8ff);color:#061018";

  const solo = document.createElement("button");
  solo.type = "button";
  solo.textContent = "단독 플레이";
  solo.style.cssText =
    "flex:0 0 auto;padding:14px 16px;font-size:13px;font-weight:600;border-radius:11px;border:1px solid rgba(255,255,255,0.18);background:rgba(20,28,52,0.6);color:#cfdcff;cursor:pointer";
  solo.style.display = opts.onSolo ? "block" : "none";

  const tip = document.createElement("div");
  tip.style.cssText = "margin-top:14px;font-size:11px;opacity:.5;color:#b8cae8;line-height:1.4";

  tip.textContent = "Enter 또는 접속 버튼으로 진입합니다.";

  const errorBox = document.createElement("div");
  errorBox.style.cssText =
    "margin-top:14px;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,128,128,0.35);background:rgba(40,8,16,0.6);color:#ffd6d6;font-size:12px;line-height:1.45;display:none";
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
