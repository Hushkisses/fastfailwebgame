import type { ReactElement } from "react";
import { buildBoxPlotGroups, type BoxPlotGroupDef, type BoxPlotGroupLabels } from "./boxPlotGroups";
import { computeBoxPlotStats, type BoxPlotStats } from "./boxPlotStats";
import type { StatAudienceFilter } from "./statBots";
import type { StatRowView } from "./statTypes";
import { computeDomain, scaleLinear, type NumericStatKey } from "./statScatter";
import styles from "./AdminPanel.module.css";

const W = 720;
const H = 360;
const MARGIN = { top: 16, right: 16, bottom: 48, left: 48 };

export interface StatBoxPlotProps {
  rows: StatRowView[];
  audienceFilter: StatAudienceFilter;
  valueKey: NumericStatKey;
  valueLabel: string;
  title: string;
  groupLabels: BoxPlotGroupLabels;
  countLabel: (n: number) => string;
  insufficientLabel: string;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function BoxShape({
  stats,
  cx,
  halfW,
  color,
  yScale
}: {
  stats: BoxPlotStats;
  cx: number;
  halfW: number;
  color: string;
  yScale: (v: number) => number;
}): ReactElement {
  const yQ1 = yScale(stats.q1);
  const yMed = yScale(stats.median);
  const yQ3 = yScale(stats.q3);
  const yMin = yScale(stats.min);
  const yMax = yScale(stats.max);
  const top = Math.min(yQ1, yQ3);
  const bot = Math.max(yQ1, yQ3);
  const cap = halfW * 0.35;

  return (
    <g>
      <line x1={cx} y1={yMin} x2={cx} y2={yMax} stroke={color} strokeWidth={1.5} opacity={0.85} />
      <line x1={cx - cap} y1={yMin} x2={cx + cap} y2={yMin} stroke={color} strokeWidth={1.5} />
      <line x1={cx - cap} y1={yMax} x2={cx + cap} y2={yMax} stroke={color} strokeWidth={1.5} />
      <rect
        x={cx - halfW}
        y={top}
        width={halfW * 2}
        height={Math.max(1, bot - top)}
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth={1.5}
      />
      <line x1={cx - halfW} y1={yMed} x2={cx + halfW} y2={yMed} stroke={color} strokeWidth={2} />
    </g>
  );
}

function layoutGroups(defs: BoxPlotGroupDef[], plotLeft: number, plotW: number): (BoxPlotGroupDef & { cx: number; stats: BoxPlotStats | null })[] {
  const n = defs.length;
  if (n === 0) return [];
  const halfW = Math.min(40, (plotW / n) * 0.32);
  return defs.map((g, i) => {
    const cx = plotLeft + ((i + 1) / (n + 1)) * plotW;
    return { ...g, cx, stats: computeBoxPlotStats(g.values) };
  });
}

export function StatBoxPlot({
  rows,
  audienceFilter,
  valueKey,
  valueLabel,
  title,
  groupLabels,
  countLabel,
  insufficientLabel
}: StatBoxPlotProps): ReactElement {
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;

  const defs = buildBoxPlotGroups(rows, valueKey, audienceFilter, groupLabels);
  const allVals = defs.flatMap((g) => g.values);

  if (allVals.length === 0 || defs.length === 0) {
    return (
      <figure className={styles.scatterCard}>
        <figcaption className={styles.scatterTitle}>{title}</figcaption>
        <p className={styles.scatterStats}>{insufficientLabel}</p>
      </figure>
    );
  }

  const yDom = computeDomain(allVals);
  const yTicks = tickValues(yDom, 5);
  const plotBottom = MARGIN.top + plotH;
  const yScale = (v: number): number => scaleLinear(v, yDom, plotBottom, MARGIN.top, false);

  const groups = layoutGroups(defs, MARGIN.left, plotW);
  const halfW = Math.min(40, (plotW / Math.max(1, groups.length)) * 0.32);

  return (
    <figure className={styles.scatterCard}>
      <figcaption className={styles.scatterTitle}>{title}</figcaption>
      <svg className={styles.scatterSvg} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={title}>
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotW}
          height={plotH}
          fill="#f8fafd"
          stroke="#d8e0ee"
          rx={4}
        />
        {yTicks.map((tv) => {
          const y = yScale(tv);
          return (
            <g key={`yg-${tv}`}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + plotW} y2={y} stroke="#e8edf5" strokeWidth={1} />
              <text
                x={MARGIN.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className={styles.scatterTick}
              >
                {formatTick(tv)}
              </text>
            </g>
          );
        })}
        {groups.map((g) =>
          g.stats ? (
            <BoxShape key={g.id} stats={g.stats} cx={g.cx} halfW={halfW} color={g.color} yScale={yScale} />
          ) : null
        )}
        {groups.map((g) => (
          <g key={`lab-${g.id}`}>
            <text x={g.cx} y={H - 14} textAnchor="middle" className={styles.scatterAxisLabel}>
              {g.label}
            </text>
            <text x={g.cx} y={H - 2} textAnchor="middle" className={styles.scatterTick}>
              {g.stats ? countLabel(g.stats.count) : countLabel(0)}
            </text>
          </g>
        ))}
        <text
          x={12}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${MARGIN.top + plotH / 2})`}
          className={styles.scatterAxisLabel}
        >
          {valueLabel}
        </text>
      </svg>
    </figure>
  );
}

function tickValues(domain: { min: number; max: number }, count: number): number[] {
  const span = domain.max - domain.min;
  if (span <= 0) return [domain.min];
  const step = niceStep(span / Math.max(1, count - 1));
  const start = Math.ceil(domain.min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= domain.max + step * 0.01; v += step) {
    ticks.push(Number(v.toPrecision(12)));
    if (ticks.length > count + 2) break;
  }
  if (ticks.length === 0) ticks.push(domain.min, domain.max);
  return ticks;
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  if (norm <= 1) return pow;
  if (norm <= 2) return 2 * pow;
  if (norm <= 5) return 5 * pow;
  return 10 * pow;
}
