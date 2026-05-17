/** 서버 봇 fill 표시명 `[groupId:index] …` (botConfig.buildBotRows) */
const BOT_NAME_RE = /^\[[^\]]+:\d+\]\s/;

export function isBotStatName(name: string): boolean {
  return BOT_NAME_RE.test(name);
}

export function countBotsInStats(rows: readonly { name: string }[]): number {
  let n = 0;
  for (const r of rows) {
    if (isBotStatName(r.name)) n += 1;
  }
  return n;
}

/** 통계 표·산점도 표시 대상 */
export type StatAudienceFilter = "players" | "bots" | "all";

export const STAT_AUDIENCE_FILTERS: StatAudienceFilter[] = ["players", "bots", "all"];

export function filterHumanPlayerStats<T extends { name: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !isBotStatName(r.name));
}

export function filterStatsByAudience<T extends { name: string }>(
  rows: readonly T[],
  mode: StatAudienceFilter
): T[] {
  switch (mode) {
    case "bots":
      return rows.filter((r) => isBotStatName(r.name));
    case "players":
      return rows.filter((r) => !isBotStatName(r.name));
    case "all":
      return [...rows];
  }
}
