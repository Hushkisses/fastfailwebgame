import { t, type Locale } from "../i18n";

export interface BoardRow {
  id: string;
  name: string;
  bestFloor: number;
  failEnergy: number;
}

/**
 * 우상단 미니 1위 패널 — 잡다 정보 제거.
 * 현재 1위 닉네임과 그 사람이 도달한 최고 층만 표시.
 */
export class LeaderboardPanel {
  private readonly root: HTMLElement;
  private readonly nameEl: HTMLDivElement;
  private readonly floorEl: HTMLDivElement;

  constructor(parent: HTMLElement, private readonly locale: Locale) {
    this.root = document.createElement("aside");
    this.root.style.position = "fixed";
    this.root.style.right = "16px";
    this.root.style.top = "16px";
    this.root.style.padding = "10px 16px";
    this.root.style.boxSizing = "border-box";
    this.root.style.background = "rgba(255,255,255,0.92)";
    this.root.style.color = "#0d1422";
    this.root.style.fontFamily = "system-ui, sans-serif";
    this.root.style.borderRadius = "12px";
    this.root.style.border = "1px solid rgba(26,143,216,0.5)";
    this.root.style.boxShadow = "0 6px 18px rgba(20,40,80,0.18)";
    this.root.style.zIndex = "30";
    this.root.style.pointerEvents = "none";
    this.root.style.minWidth = "140px";
    this.root.style.textAlign = "left";
    this.root.style.backdropFilter = "blur(4px)";

    const label = document.createElement("div");
    label.textContent = t(this.locale, "leaderboard.rankOne");
    label.style.fontSize = "10px";
    label.style.fontWeight = "800";
    label.style.letterSpacing = "0.22em";
    label.style.opacity = "0.95";
    label.style.color = "#1a8fd8";
    label.style.marginBottom = "4px";

    this.nameEl = document.createElement("div");
    this.nameEl.style.fontSize = "17px";
    this.nameEl.style.fontWeight = "800";
    this.nameEl.style.color = "#0d1422";
    this.nameEl.style.letterSpacing = "0.02em";
    this.nameEl.textContent = "—";

    this.floorEl = document.createElement("div");
    this.floorEl.style.fontSize = "11px";
    this.floorEl.style.fontWeight = "700";
    this.floorEl.style.opacity = "0.78";
    this.floorEl.style.color = "#3a4458";
    this.floorEl.style.marginTop = "3px";
    this.floorEl.textContent = "";

    this.root.append(label, this.nameEl, this.floorEl);
    parent.appendChild(this.root);
  }

  /** 옛 호출부 호환용 — 잡다 정보 노출 안 함 (no-op) */
  flashFailSync(_patch: {
    gainedEnergy?: number;
    jump?: number;
    speed?: number;
    energy?: number;
    runPeakConsumed?: number;
  }): void {
    /* no-op */
  }

  render(rows: BoardRow[], highlightId: string): void {
    if (!rows.length) {
      this.nameEl.textContent = "—";
      this.floorEl.textContent = "";
      return;
    }
    const top = [...rows].sort((a, b) => {
      if (b.bestFloor !== a.bestFloor) return b.bestFloor - a.bestFloor;
      if (b.failEnergy !== a.failEnergy) return b.failEnergy - a.failEnergy;
      return a.name.localeCompare(b.name);
    })[0]!;

    const isYou = top.id === highlightId;
    this.nameEl.textContent = isYou ? `${top.name} (${t(this.locale, "leaderboard.you")})` : top.name;
    this.nameEl.style.color = isYou ? "#1a8fd8" : "#0d1422";
    this.floorEl.textContent = t(this.locale, "leaderboard.bestFloor", { floor: top.bestFloor });
  }
}
