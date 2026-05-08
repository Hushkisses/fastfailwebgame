export interface BoardRow {
  id: string;
  name: string;
  bestFloor: number;
  failEnergy: number;
}

/**
 * 실시간 전광판: Fail-Energy 우선, 그다음 최고 층.
 */
export class LeaderboardPanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly syncBanner: HTMLDivElement;
  private syncHideTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("aside");
    this.root.style.position = "fixed";
    this.root.style.right = "0";
    this.root.style.top = "0";
    this.root.style.width = "280px";
    this.root.style.maxHeight = "100vh";
    this.root.style.overflow = "auto";
    this.root.style.padding = "12px 14px";
    this.root.style.boxSizing = "border-box";
    this.root.style.background = "linear-gradient(270deg, rgba(8,10,18,0.92), rgba(8,10,18,0.55))";
    this.root.style.color = "#e8ecff";
    this.root.style.fontFamily = "system-ui, sans-serif";
    this.root.style.fontSize = "12px";
    this.root.style.borderLeft = "1px solid rgba(255,255,255,0.08)";
    this.root.style.zIndex = "30";
    this.root.style.pointerEvents = "none";

    const title = document.createElement("div");
    title.textContent = "전광판 (100인)";
    title.style.fontWeight = "700";
    title.style.marginBottom = "6px";
    title.style.letterSpacing = "0.04em";

    const sub = document.createElement("div");
    sub.textContent = "최고 도달 줄(층)·닉네임 기준 순위";
    sub.style.opacity = "0.72";
    sub.style.marginBottom = "10px";
    sub.style.lineHeight = "1.35";

    this.list = document.createElement("ul");
    this.list.style.listStyle = "none";
    this.list.style.padding = "0";
    this.list.style.margin = "0";

    this.syncBanner = document.createElement("div");
    this.syncBanner.style.display = "none";
    this.syncBanner.style.marginBottom = "12px";
    this.syncBanner.style.padding = "14px 12px";
    this.syncBanner.style.borderRadius = "10px";
    this.syncBanner.style.background =
      "linear-gradient(135deg, rgba(120,210,255,0.18), rgba(255,208,140,0.16))";
    this.syncBanner.style.border = "1px solid rgba(255,255,255,0.14)";
    this.syncBanner.style.fontSize = "13px";
    this.syncBanner.style.lineHeight = "1.48";
    this.syncBanner.style.fontWeight = "600";
    this.syncBanner.style.textAlign = "center";
    this.syncBanner.style.textShadow = "0 2px 8px rgba(0,0,0,0.35)";

    this.root.append(title, sub, this.syncBanner, this.list);
    parent.appendChild(this.root);
  }

  /** 실패 후 1층 복귀 시 눈에 띄는 성장 브리핑 */
  flashFailSync(patch: {
    gainedEnergy?: number;
    jump?: number;
    speed?: number;
    energy?: number;
    runPeakConsumed?: number;
  }): void {
    window.clearTimeout(this.syncHideTimer);
    const gained = patch.gainedEnergy ?? 0;
    const jp = patch.jump ?? 0;
    const sp = patch.speed ?? 0;
    const en = patch.energy ?? 0;
    const peak =
      patch.runPeakConsumed !== undefined ? ` · 런 피크 ${patch.runPeakConsumed}F 반영` : "";

    this.syncBanner.innerHTML = `New Data Synced!<br/>
      <span style="font-weight:600;opacity:.95;margin-top:8px;display:block;font-size:12px;line-height:1.45">
      새로운 데이터 동기화 완료${peak}<br/>
      ΔE +${escapeHtml(
        gained.toFixed(2)
      )} · Jump ${escapeHtml(
        jp.toFixed(1)
      )} · Speed ${escapeHtml(sp.toFixed(2))}<br/>
      누적 E ${escapeHtml(en.toFixed(2))}</span>`;
    this.syncBanner.style.display = "block";
    this.syncHideTimer = window.setTimeout(() => {
      this.syncBanner.style.display = "none";
    }, 6500);
  }

  render(rows: BoardRow[], highlightId: string): void {
    const sorted = [...rows].sort((a, b) => {
      if (b.bestFloor !== a.bestFloor) return b.bestFloor - a.bestFloor;
      if (b.failEnergy !== a.failEnergy) return b.failEnergy - a.failEnergy;
      return a.name.localeCompare(b.name);
    });

    this.list.replaceChildren();
    sorted.slice(0, 100).forEach((r, idx) => {
      const li = document.createElement("li");
      li.style.padding = "6px 0";
      li.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
      const energy = r.failEnergy.toFixed(1);
      const mark = r.id === highlightId ? " ▸" : "";
      li.innerHTML = `<span style="opacity:0.55">#${idx + 1}</span> <b>${escapeHtml(r.name)}</b>${mark}<br/>
        <span style="opacity:0.85">★ 최고 줄 ${escapeHtml(
          String(r.bestFloor)
        )}</span> · <span style="opacity:0.7">실패 에너지 ${energy}</span>`;
      this.list.appendChild(li);
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
