import type { AuraTier } from "../config/gameBalance.js";



export function computeAuraTierEnergy(failEnergy: number): AuraTier {

  const e = Math.max(0, failEnergy);

  if (e >= 600) return "gold";

  if (e >= 180) return "purple";

  return "blue";

}


