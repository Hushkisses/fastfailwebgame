import {
  getStoredLocale,
  htmlLang,
  locales,
  setStoredLocale,
  t,
  type Locale
} from "../i18n";

/** 닉네임 입력 후 접속 — Colyseus join 전까지 게임 초기화를 막음. */
export function openNicknameGate(opts: {
  overlayParent: HTMLElement;
  introTitle?: string;
  initialLocale?: Locale;
  onJoin: (nickname: string, locale: Locale) => void | Promise<void>;
  /** (선택) 서버 없이 단독 플레이 — 버튼이 추가되어 활성화된다 */
  onSolo?: (nickname: string, locale: Locale) => void | Promise<void>;
}): () => void {
  let locale = opts.initialLocale ?? getStoredLocale();
  document.documentElement.lang = htmlLang(locale);

  const veil = document.createElement("div");
  veil.style.cssText =
    "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,rgba(180,210,245,0.55),rgba(243,245,249,0.96));font-family:system-ui,sans-serif";

  const card = document.createElement("div");
  card.style.cssText =
    "width:min(420px,calc(100vw - 32px));padding:28px 26px;background:#ffffff;border:1px solid rgba(26,143,216,0.35);border-radius:14px;box-shadow:0 18px 48px rgba(20,40,80,0.18)";

  const h1 = document.createElement("h1");
  h1.style.cssText = "margin:0 0 8px;font-size:21px;color:#0d1422;font-weight:800";

  const sub = document.createElement("p");
  sub.style.cssText =
    "margin:0 0 18px;font-size:13px;line-height:1.45;color:#445064";

  const languageLabel = document.createElement("label");
  languageLabel.style.display = "block";
  languageLabel.style.marginBottom = "6px";
  languageLabel.style.fontSize = "12px";
  languageLabel.style.fontWeight = "700";
  languageLabel.style.color = "#2a3344";

  const languageSelect = document.createElement("select");
  languageSelect.style.cssText =
    "width:100%;box-sizing:border-box;padding:11px 14px;margin-bottom:16px;font-size:15px;border-radius:10px;border:1px solid #c2cfe0;background:#f8fafd;color:#0d1422";
  for (const code of locales) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = t(locale, `language.${code}`);
    languageSelect.append(opt);
  }
  languageSelect.value = locale;

  const label = document.createElement("label");
  label.style.display = "block";
  label.style.marginBottom = "6px";
  label.style.fontSize = "12px";
  label.style.fontWeight = "700";
  label.style.color = "#2a3344";

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 18;
  input.autocomplete = "username";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:16px;font-size:16px;border-radius:10px;border:1px solid #c2cfe0;background:#f8fafd;color:#0d1422";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px";

  const go = document.createElement("button");
  go.type = "button";
  go.style.cssText =
    "flex:1;padding:14px;font-size:15px;font-weight:800;border-radius:11px;border:none;cursor:pointer;background:linear-gradient(135deg,#1a8fd8,#3ab5ee);color:#ffffff;box-shadow:0 4px 10px rgba(26,143,216,0.35)";

  const solo = document.createElement("button");
  solo.type = "button";
  solo.style.cssText =
    "flex:0 0 auto;padding:14px 16px;font-size:13px;font-weight:700;border-radius:11px;border:1px solid #c2cfe0;background:#ffffff;color:#2a3344;cursor:pointer";
  solo.style.display = opts.onSolo ? "block" : "none";

  const tip = document.createElement("div");
  tip.style.cssText = "margin-top:14px;font-size:11px;color:#7080a0;line-height:1.4";

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

  const renderTexts = (): void => {
    h1.textContent = opts.introTitle ?? t(locale, "lobby.title");
    sub.textContent = t(locale, "lobby.subtitle");
    languageLabel.textContent = t(locale, "language.label");
    for (const option of Array.from(languageSelect.options)) {
      option.textContent = t(locale, `language.${option.value}`);
    }
    label.textContent = t(locale, "lobby.nicknameLabel");
    input.placeholder = t(locale, "lobby.nicknamePlaceholder");
    go.textContent = t(locale, "lobby.join");
    solo.textContent = t(locale, "lobby.solo");
    tip.textContent = t(locale, "lobby.tip");
  };

  const submit = async (): Promise<void> => {
    const raw = input.value.trim();
    const fallback = `${t(locale, "lobby.defaultNickname")}-${Math.floor(Math.random() * 99999)}`;
    const sanitized = sanitizeNickname(raw || fallback, t(locale, "lobby.defaultNickname"));
    input.disabled = true;
    languageSelect.disabled = true;
    go.disabled = true;
    solo.disabled = true;
    errorBox.style.display = "none";
    try {
      setStoredLocale(locale);
      await opts.onJoin(sanitized, locale);
      cleanup();
    } catch (e) {
      input.disabled = false;
      languageSelect.disabled = false;
      go.disabled = false;
      solo.disabled = false;
      showError(t(locale, "lobby.connectError"));
      console.warn("[loginGate] connect failed", e);
    }
  };

  const submitSolo = async (): Promise<void> => {
    if (!opts.onSolo) return;
    const raw = input.value.trim();
    const fallback = `${t(locale, "lobby.defaultSoloNickname")}-${Math.floor(Math.random() * 9999)}`;
    const sanitized = sanitizeNickname(raw || fallback, t(locale, "lobby.defaultSoloNickname"));
    input.disabled = true;
    languageSelect.disabled = true;
    go.disabled = true;
    solo.disabled = true;
    errorBox.style.display = "none";
    try {
      setStoredLocale(locale);
      await opts.onSolo(sanitized, locale);
      cleanup();
    } catch (e) {
      input.disabled = false;
      languageSelect.disabled = false;
      go.disabled = false;
      solo.disabled = false;
      showError(t(locale, "lobby.soloError"));
      console.warn("[loginGate] solo failed", e);
    }
  };

  languageSelect.onchange = () => {
    locale = languageSelect.value as Locale;
    setStoredLocale(locale);
    errorBox.style.display = "none";
    renderTexts();
  };
  go.onclick = () => void submit();
  solo.onclick = () => void submitSolo();
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") void submit();
  });

  row.append(go);
  if (opts.onSolo) row.append(solo);
  renderTexts();
  card.append(h1, sub, languageLabel, languageSelect, label, input, row, tip, errorBox);
  veil.append(card);
  opts.overlayParent.append(veil);
  queueMicrotask(() => input.focus());

  return cleanup;
}

function sanitizeNickname(s: string, fallback: string): string {
  let t = s.trim().slice(0, 18).replace(/\s+/g, " ");
  t = t.replace(/[<>'"&|\\]/g, "");
  return t.length ? t.slice(0, 18) : fallback;
}
