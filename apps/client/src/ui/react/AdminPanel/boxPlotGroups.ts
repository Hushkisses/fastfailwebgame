import { isBotStatName, type StatAudienceFilter } from "./statBots";
import type { StatRowView } from "./statTypes";
import { statValue, type NumericStatKey } from "./statScatter";

export interface BoxPlotGroupDef {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export function isConservativeBotName(name: string): boolean {
  return /^\[conservative:/i.test(name);
}

export function isBoldBotName(name: string): boolean {
  return /^\[bold:/i.test(name);
}

export interface BoxPlotGroupLabels {
  stripShown: string;
  stripHidden: string;
  conservative: string;
  bold: string;
}

const COLORS = {
  stripShown: "#1a8fd8",
  stripHidden: "#94a3b8",
  conservative: "#4a7fc8",
  bold: "#c85a4a"
} as const;

export function buildBoxPlotGroups(
  rows: readonly StatRowView[],
  valueKey: NumericStatKey,
  audience: StatAudienceFilter,
  labels: BoxPlotGroupLabels
): BoxPlotGroupDef[] {
  const out: BoxPlotGroupDef[] = [];

  const push = (id: string, label: string, color: string, pred: (r: StatRowView) => boolean): void => {
    const values = rows.filter(pred).map((r) => statValue(r, valueKey));
    if (values.length > 0) {
      out.push({ id, label, color, values });
    }
  };

  if (audience === "bots") {
    push("conservative", labels.conservative, COLORS.conservative, (r) => isConservativeBotName(r.name));
    push("bold", labels.bold, COLORS.bold, (r) => isBoldBotName(r.name));
    return out;
  }

  if (audience === "players") {
    push("stripShown", labels.stripShown, COLORS.stripShown, (r) => !isBotStatName(r.name) && r.showRecentTileStrip);
    push("stripHidden", labels.stripHidden, COLORS.stripHidden, (r) => !isBotStatName(r.name) && !r.showRecentTileStrip);
    return out;
  }

  push("conservative", labels.conservative, COLORS.conservative, (r) => isConservativeBotName(r.name));
  push("bold", labels.bold, COLORS.bold, (r) => isBoldBotName(r.name));
  push("stripShown", labels.stripShown, COLORS.stripShown, (r) => !isBotStatName(r.name) && r.showRecentTileStrip);
  push("stripHidden", labels.stripHidden, COLORS.stripHidden, (r) => !isBotStatName(r.name) && !r.showRecentTileStrip);
  return out;
}
