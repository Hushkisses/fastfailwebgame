import type { ReactElement } from "react";
import type { StatRowView } from "./statTypes";
import {
  computeDomain,
  formatCorrelation,
  formatRegressionCoeff,
  linearRegression,
  pearsonCorrelation,
  pointColor,
  scaleAxisX,
  scaleAxisY,
  statValue,
  type NumericStatKey,
  type PlotDomain
} from "./statScatter";
import styles from "./AdminPanel.module.css";

const SIZE = {
  normal: { w: 420, h: 260 },
  large: { w: 720, h: 360 }
} as const;

const MARGIN = { top: 16, right: 16, bottom: 40, left: 48 };

export interface StatScatterPlotProps {
  rows: StatRowView[];
  xKey: NumericStatKey;
  yKey: NumericStatKey;
  xLabel: string;
  yLabel: string;
  title: string;
  correlationLabel: (r: string) => string;
  trendLabel: (slope: string, intercept: string, interceptSign: string) => string;
  insufficientLabel: string;
  large?: boolean;
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
  title,
  correlationLabel,
  trendLabel,
  insufficientLabel,
  large = false
}: StatScatterPlotProps): ReactElement {
  const { w: W, h: H } = large ? SIZE.large : SIZE.normal;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;

  const xs = rows.map((r) => statValue(r, xKey));
  const ys = rows.map((r) => statValue(r, yKey));
  const xDom = computeDomain(xs);
  const yDom = computeDomain(ys);

  const xTicks = tickValues(xDom, 5);
  const yTicks = tickValues(yDom, 5);

  const r = pearsonCorrelation(xs, ys);
  const reg = linearRegression(xs, ys);
  const plotLeft = MARGIN.left;
  const plotRight = MARGIN.left + plotW;
  const plotTop = MARGIN.top;
  const plotBottom = MARGIN.top + plotH;

  let trendX1 = 0;
  let trendY1 = 0;
  let trendX2 = 0;
  let trendY2 = 0;
  let hasTrendLine = false;
  if (reg) {
    const xA = xDom.min;
    const xB = xDom.max;
    const yA = reg.slope * xA + reg.intercept;
    const yB = reg.slope * xB + reg.intercept;
    trendX1 = scaleAxisX(xA, xDom, plotLeft, plotRight, xKey);
    trendY1 = scaleAxisY(yA, yDom, plotTop, plotBottom, yKey);
    trendX2 = scaleAxisX(xB, xDom, plotLeft, plotRight, xKey);
    trendY2 = scaleAxisY(yB, yDom, plotTop, plotBottom, yKey);
    hasTrendLine = true;
  }

  const interceptAbs = reg ? formatRegressionCoeff(Math.abs(reg.intercept)) : "";
  const interceptSign = reg && reg.intercept >= 0 ? "+" : reg && reg.intercept < 0 ? "−" : "";

  return (
    <figure className={styles.scatterCard}>
      <figcaption className={styles.scatterTitle}>{title}</figcaption>
      <p className={styles.scatterStats}>
        {r !== null && reg
          ? (
              <>
                <span>{correlationLabel(formatCorrelation(r))}</span>
                <span className={styles.scatterStatsSep}> · </span>
                <span>
                  {trendLabel(
                    formatRegressionCoeff(reg.slope),
                    interceptAbs,
                    interceptSign
                  )}
                </span>
              </>
            )
          : insufficientLabel}
      </p>
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
          width={plotW}
          height={plotH}
          fill="#f8fafd"
          stroke="#d8e0ee"
          rx={4}
        />
        {yTicks.map((tv) => {
          const y = scaleAxisY(tv, yDom, MARGIN.top, MARGIN.top + plotH, yKey);
          return (
            <g key={`yg-${tv}`}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + plotW}
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
          const x = scaleAxisX(tv, xDom, MARGIN.left, MARGIN.left + plotW, xKey);
          return (
            <g key={`xg-${tv}`}>
              <line
                x1={x}
                y1={MARGIN.top}
                x2={x}
                y2={MARGIN.top + plotH}
                stroke="#e8edf5"
                strokeWidth={1}
              />
              <text
                x={x}
                y={MARGIN.top + plotH + 16}
                textAnchor="middle"
                className={styles.scatterTick}
              >
                {formatTick(tv)}
              </text>
            </g>
          );
        })}
        {hasTrendLine ? (
          <line
            x1={trendX1}
            y1={trendY1}
            x2={trendX2}
            y2={trendY2}
            stroke="#e85a4a"
            strokeWidth={2}
            strokeOpacity={0.85}
            strokeDasharray="6 4"
          />
        ) : null}
        {rows.map((row, i) => {
          const x = scaleAxisX(statValue(row, xKey), xDom, MARGIN.left, MARGIN.left + plotW, xKey);
          const y = scaleAxisY(statValue(row, yKey), yDom, MARGIN.top, MARGIN.top + plotH, yKey);
          return (
            <circle
              key={`${row.name}-${i}`}
              cx={x}
              cy={y}
              r={rows.length > 60 ? 2.5 : 3.5}
              fill={pointColor(row)}
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
          x={MARGIN.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          className={styles.scatterAxisLabel}
        >
          {xLabel}
        </text>
        <text
          x={12}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${MARGIN.top + plotH / 2})`}
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
