import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import { t, type Locale } from "../i18n";
import type { ClimbHudModel } from "../render/ClimbStage";

const FAIL_ENERGY_STAGE_THRESHOLDS = [0, 180, 600] as const;

export class ClimbHudPanel {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly energyLabel: HTMLDivElement;
  private readonly energyFill: HTMLDivElement;
  private readonly status: HTMLDivElement;

  constructor(parent: HTMLElement, private readonly locale: Locale) {
    this.root = document.createElement("div");
    this.root.style.cssText =
      "position:fixed;left:12px;top:12px;z-index:40;width:268px;box-sizing:border-box;padding:14px 16px 15px 18px;border-radius:12px;background:rgba(255,255,255,0.88);border:1px solid rgba(26,143,216,0.5);border-left:4px solid #1a8fd8;box-shadow:0 6px 18px rgba(20,40,80,0.14);font-family:system-ui,sans-serif;color:#0d1422;pointer-events:none;backdrop-filter:blur(4px)";

    this.title = document.createElement("div");
    this.title.style.cssText = "font-size:17px;font-weight:800;line-height:1.35;letter-spacing:.02em";

    this.energyLabel = document.createElement("div");
    this.energyLabel.style.cssText =
      "margin-top:12px;font-size:12px;font-weight:800;line-height:1.35;color:#2a3344";

    const energyBar = document.createElement("div");
    energyBar.style.cssText =
      "margin-top:6px;height:11px;border-radius:999px;background:#dde8f6;overflow:hidden;border:1px solid rgba(255,255,255,0.9);box-sizing:border-box";

    this.energyFill = document.createElement("div");
    this.energyFill.style.cssText =
      "height:100%;width:0%;border-radius:999px;background:#1a8fd8;transition:width 120ms linear";
    energyBar.append(this.energyFill);

    this.status = document.createElement("div");
    this.status.style.cssText =
      "margin-top:9px;min-height:16px;font-size:12px;font-weight:700;line-height:1.35;color:#2a3344;white-space:pre-line";

    this.root.append(this.title, this.energyLabel, energyBar, this.status);
    parent.appendChild(this.root);
  }

  render(model: ClimbHudModel): void {
    this.title.textContent = [
      t(this.locale, "hud.currentFloor", { floor: model.floor }),
      t(this.locale, "hud.goalFloor", { floor: CLIENT_GOAL_FLOOR })
    ].join("\n");
    this.title.style.whiteSpace = "pre-line";

    this.energyLabel.textContent = t(this.locale, "hud.failEnergyLabel");
    this.energyFill.style.width = `${this.failEnergyProgress(model.failEnergy) * 100}%`;

    const nowTs = Date.now();
    const wait =
      model.respawnAvailableAt > nowTs ? Math.ceil((model.respawnAvailableAt - nowTs) / 100) / 10 : 0;
    const messages = [
      model.hasWon ? t(this.locale, "hud.win") : "",
      wait > 0 ? t(this.locale, "hud.respawnWait", { seconds: wait }) : ""
    ].filter(Boolean);
    this.status.textContent = messages.join("\n");
  }

  private failEnergyProgress(failEnergy: number): number {
    const energy = Math.max(0, failEnergy);
    for (let i = 1; i < FAIL_ENERGY_STAGE_THRESHOLDS.length; i++) {
      const prev = FAIL_ENERGY_STAGE_THRESHOLDS[i - 1]!;
      const next = FAIL_ENERGY_STAGE_THRESHOLDS[i]!;
      if (energy < next) return Math.max(0, Math.min(1, (energy - prev) / (next - prev)));
    }
    return 1;
  }
}
