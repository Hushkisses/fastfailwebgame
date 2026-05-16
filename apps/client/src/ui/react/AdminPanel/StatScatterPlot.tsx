import type { ReactElement } from "react";
import type { StatRowView } from "./statTypes";
import {
  computeDomain,
  pointColor,
  scaleLinear,
  statValue,
  type NumericStatKey,
  type PlotDomain
} from "./statScatter";
import styles from "./AdminPanel.module.css";

const W = 420;
const H = 260;
const MARGIN = { top: 16, right: 16, bottom: 40, left: 48 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

export interface StatScatterPlotProps {
  rows: StatRowView[];
  xKey: NumericStatKey;
  yKey: NumericStatKey;
  xLabel: string;
  yLabel: string;
  title: string;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function StatScatterPlot({
  rows,
  xKey,
  yKey,
  xLabel,
  yLabel,
  title
}: StatScatterPlotProps): ReactElement {
  const xs = rows.map((r) => statValue(r, xKey));
  const ys = rows.map((r) => statValue(r, yKey));
  const xDom = computeDomain(xs);
  const yDom = computeDomain(ys);

  const xTicks = tickValues(xDom, 5);
  const yTicks = tickValues(yDom, 5);

  return (
    <figure className={styles.scatterCard}>
      <figcaption className={styles.scatterTitle}>{title}</figcaption>
      <svg
        className={styles.scatterSvg}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={title}
      >
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="#f8fafd"
          stroke="#d8e0ee"
          rx={4}
        />
        {yTicks.map((tv) => {
          const y = scaleLinear(tv, yDom, MARGIN.top, MARGIN.top + PLOT_H);
          return (
            <g key={`yg-${tv}`}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + PLOT_W}
                y2={y}
                stroke="#e8edf5"
                strokeWidth={1}
              />
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
        {xTicks.map((tv) => {
          const x = scaleLinear(tv, xDom, MARGIN.left, MARGIN.left + PLOT_W);
          return (
            <g key={`xg-${tv}`}>
              <line
                x1={x}
                y1={MARGIN.top}
                x2={x}
                y2={MARGIN.top + PLOT_H}
                stroke="#e8edf5"
                strokeWidth={1}
              />
              <text
                x={x}
                y={MARGIN.top + PLOT_H + 16}
                textAnchor="middle"
                className={styles.scatterTick}
              >
                {formatTick(tv)}
              </text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const x = scaleLinear(statValue(row, xKey), xDom, MARGIN.left, MARGIN.left + PLOT_W);
          const y = scaleLinear(statValue(row, yKey), yDom, MARGIN.top, MARGIN.top + PLOT_H);
          return (
            <circle
              key={`${row.name}-${i}`}
              cx={x}
              cy={y}
              r={rows.length > 60 ? 2.5 : 3.5}
              fill={pointColor(row.name)}
              fillOpacity={0.72}
              stroke="#fff"
              strokeWidth={0.6}
            >
              <title>
                {row.name}
                {"\n"}
                {xLabel}: {statValue(row, xKey)} · {yLabel}: {statValue(row, yKey)}
              </title>
            </circle>
          );
        })}
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={H - 6}
          textAnchor="middle"
          className={styles.scatterAxisLabel}
        >
          {xLabel}
        </text>
        <text
          x={12}
          y={MARGIN.top + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${MARGIN.top + PLOT_H / 2})`}
          className={styles.scatterAxisLabel}
        >
          {yLabel}
        </text>
      </svg>
    </figure>
  );
}

function tickValues(domain: PlotDomain, count: number): number[] {
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
