export class Hud {
  private readonly root: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly help: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.position = "fixed";
    this.root.style.left = "12px";
    this.root.style.top = "12px";
    this.root.style.color = "#f1f4ff";
    this.root.style.fontFamily = "system-ui, sans-serif";
    this.root.style.fontSize = "14px";
    this.root.style.pointerEvents = "none";

    this.stats = document.createElement("div");
    this.help = document.createElement("div");
    this.help.textContent =
      "입체 타일(윗면+옆면) + 높이(Z). 가능한 타일 탭 이동. 트랩이면 높낮 보정 추락 애니 (V: 아래 또는 오른쪽 이웃).";
    this.help.style.marginTop = "6px";
    this.help.style.opacity = "0.8";
    this.root.append(this.stats, this.help);
    parent.appendChild(this.root);
  }

  render(values: {
    failCount: number;
    floor: number;
    jumpPower: number;
    moveSpeed: number;
    auraTier: string;
    hintCooldownLeftMs: number;
  }): void {
    this.stats.textContent = `Map:10×10  Iso 64×32  Pos:${values.floor}  CellH:${values.jumpPower}  ${values.auraTier}`;
  }
}
