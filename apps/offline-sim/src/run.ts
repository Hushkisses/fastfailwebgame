import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSimConfig } from "./config.js";
import { runOneBot, type RunResultRow } from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  const local = resolve(__dirname, "../sim-config.json");
  const example = resolve(__dirname, "../sim-config.example.json");
  let configPath = existsSync(local) ? local : example;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) {
      configPath = resolve(process.cwd(), args[++i]!);
    }
  }
  return { configPath };
}

function csvEscape(s: string | number | boolean): string {
  const t = String(s);
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function avgThink(row: RunResultRow): number {
  return row.thinkDecisions > 0 ? row.totalThinkMs / row.thinkDecisions : 0;
}

function buildReportHtml(summary: SummaryRow[]): string {
  const json = JSON.stringify(summary).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>오프라인 시뮬 통계</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0f1218; color: #e8eaef; }
    h1 { font-size: 1.25rem; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { border: 1px solid #2a3140; padding: 10px 12px; text-align: left; }
    th { background: #1a2130; cursor: pointer; user-select: none; }
    tr:nth-child(even) td { background: #141a24; }
    .muted { color: #8b95a8; font-size: 0.9rem; margin-top: 8px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <h1>오프라인 시뮬레이션 요약</h1>
  <p class="muted">네트워크를 사용하지 않습니다. 열 제목 클릭 시 정렬됩니다.</p>
  <table id="t">
    <thead>
      <tr>
        <th data-k="groupLabel">그룹</th>
        <th data-k="n" class="num">인원</th>
        <th data-k="wins" class="num">승리 수</th>
        <th data-k="winRate" class="num">승률</th>
        <th data-k="meanBestFloor" class="num">평균 최고 층</th>
        <th data-k="meanFailCount" class="num">평균 실패</th>
        <th data-k="meanHints" class="num">평균 힌트</th>
        <th data-k="meanAvgThinkMs" class="num">평균 고민(ms)</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <script>
    const SUMMARY = ${json};
    const tbody = document.querySelector("#t tbody");
    let sortKey = "groupLabel";
    let asc = true;

    function fmt(n, d) {
      if (typeof n !== "number" || !Number.isFinite(n)) return "—";
      return n.toFixed(d);
    }

    function cmp(a, b, key) {
      const va = a[key],
        vb = b[key];
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "ko");
    }

    function cell(r, k) {
      if (k === "winRate") return fmt(100 * r.winRate, 1) + "%";
      if (k === "groupLabel") return r.groupLabel;
      if (k === "n" || k === "wins") return String(Math.round(r[k]));
      if (k === "meanHints") return fmt(r[k], 2);
      if (k === "meanAvgThinkMs") return fmt(r[k], 0);
      return fmt(r[k], 1);
    }

    function render() {
      const rows = [...SUMMARY].sort((a, b) => {
        const c = cmp(a, b, sortKey);
        return asc ? c : -c;
      });
      const keys = [
        "groupLabel",
        "n",
        "wins",
        "winRate",
        "meanBestFloor",
        "meanFailCount",
        "meanHints",
        "meanAvgThinkMs"
      ];
      tbody.innerHTML = rows
        .map((r) => "<tr>" + keys.map((k) => "<td class='" + (k === "groupLabel" ? "" : "num") + "'>" + cell(r, k) + "</td>").join("") + "</tr>")
        .join("");
    }

    document.querySelectorAll("#t th[data-k]").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.getAttribute("data-k");
        if (sortKey === k) asc = !asc;
        else {
          sortKey = k;
          asc = k === "groupLabel";
        }
        render();
      });
    });
    render();
  </script>
</body>
</html>
`;
}

interface SummaryRow {
  groupId: string;
  groupLabel: string;
  n: number;
  wins: number;
  winRate: number;
  meanBestFloor: number;
  meanFailCount: number;
  meanHints: number;
  meanAvgThinkMs: number;
}

function aggregate(rows: RunResultRow[]): SummaryRow[] {
  const by = new Map<string, RunResultRow[]>();
  for (const r of rows) {
    const k = r.groupId;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(r);
  }
  const out: SummaryRow[] = [];
  for (const [, list] of by) {
    const n = list.length;
    const wins = list.filter((x) => x.won).length;
    const mean = (f: (x: RunResultRow) => number) => list.reduce((a, x) => a + f(x), 0) / n;
    out.push({
      groupId: list[0]!.groupId,
      groupLabel: list[0]!.groupLabel,
      n,
      wins,
      winRate: wins / n,
      meanBestFloor: mean((x) => x.bestFloorReached),
      meanFailCount: mean((x) => x.failCount),
      meanHints: mean((x) => x.hintsUsed),
      meanAvgThinkMs: mean((x) => avgThink(x))
    });
  }
  out.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "ko"));
  return out;
}

function main(): void {
  const { configPath } = parseArgs();
  const configAbs = resolve(configPath);
  const cfg = loadSimConfig(configAbs);
  const outDir = resolve(dirname(configAbs), cfg.outputDir);
  mkdirSync(outDir, { recursive: true });

  const rows: RunResultRow[] = [];
  let gi = 0;
  for (const group of cfg.groups) {
    for (let b = 0; b < group.count; b++) {
      rows.push(runOneBot(group, gi, b, cfg.seed, cfg.maxStepsPerRun));
    }
    gi += 1;
  }

  const header = [
    "groupId",
    "groupLabel",
    "botIndex",
    "won",
    "failCount",
    "bestFloorReached",
    "hintsUsed",
    "avgThinkMs",
    "thinkDecisions",
    "steps"
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.groupId,
        r.groupLabel,
        r.botIndex,
        r.won,
        r.failCount,
        r.bestFloorReached,
        r.hintsUsed,
        avgThink(r).toFixed(1),
        r.thinkDecisions,
        r.steps
      ]
        .map(csvEscape)
        .join(",")
    )
  ];
  writeFileSync(resolve(outDir, "results.csv"), lines.join("\n") + "\n", "utf8");
  writeFileSync(resolve(outDir, "results.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const summary = aggregate(rows);
  writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(resolve(outDir, "report.html"), buildReportHtml(summary), "utf8");

  console.log(`오프라인 시뮬 완료: ${rows.length} 런`);
  console.log(`출력: ${outDir}`);
  console.log(`  - results.csv / results.jsonl / summary.json / report.html`);
  console.log(`브라우저에서 열기: file:///${outDir.replace(/\\/g, "/")}/report.html`);
}

main();
