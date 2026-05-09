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

  constructor(parent: HTMLElement) {
    this.root = document.createElement("aside");
    this.root.style.position = "fixed";
    this.root.style.right = "16px";
    this.root.style.top = "16px";
    this.root.style.padding = "10px 16px";
    this.root.style.boxSizing = "border-box";
    this.root.style.background = "rgba(8,10,18,0.78)";
    this.root.style.color = "#e8ecff";
    this.root.style.fontFamily = "system-ui, sans-serif";
    this.root.style.borderRadius = "12px";
    this.root.style.border = "1px solid rgba(120,200,255,0.28)";
    this.root.style.boxShadow = "0 8px 22px rgba(0,0,0,0.45)";
    this.root.style.zIndex = "30";
    this.root.style.pointerEvents = "none";
    this.root.style.minWidth = "140px";
    this.root.style.textAlign = "left";
    this.root.style.backdropFilter = "blur(4px)";

    const label = document.createElement("div");
    label.textContent = "1 위";
    label.style.fontSize = "10px";
    label.style.fontWeight = "700";
    label.style.letterSpacing = "0.22em";
    label.style.opacity = "0.78";
    label.style.color = "#aef0ff";
    label.style.marginBottom = "4px";

    this.nameEl = document.createElement("div");
    this.nameEl.style.fontSize = "17px";
    this.nameEl.style.fontWeight = "800";
    this.nameEl.style.color = "#f4f8ff";
    this.nameEl.style.letterSpacing = "0.02em";
    this.nameEl.textContent = "—";

    this.floorEl = document.createElement("div");
    this.floorEl.style.fontSize = "11px";
    this.floorEl.style.fontWeight = "600";
    this.floorEl.style.opacity = "0.72";
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
    this.nameEl.textContent = isYou ? `${top.name} (YOU)` : top.name;
    this.nameEl.style.color = isYou ? "#aef0ff" : "#f4f8ff";
    this.floorEl.textContent = `최고 ${top.bestFloor}층`;
  }
}
