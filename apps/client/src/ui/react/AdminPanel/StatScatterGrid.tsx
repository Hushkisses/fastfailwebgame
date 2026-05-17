import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { buildBoxPlotGroups } from "./boxPlotGroups";
import type { StatAudienceFilter } from "./statBots";
import type { StatRowView } from "./statTypes";
import { NUMERIC_STAT_KEYS, type NumericStatKey } from "./statScatter";
import { StatBoxPlot } from "./StatBoxPlot";
import { StatScatterPlot } from "./StatScatterPlot";
import styles from "./AdminPanel.module.css";

export interface StatScatterGridProps {
  rows: StatRowView[];
  audienceFilter: StatAudienceFilter;
  audienceIncludesPlayers: boolean;
  axisLabel: (key: NumericStatKey) => string;
  pairTitle: (xKey: NumericStatKey, yKey: NumericStatKey) => string;
  boxTitle: (varLabel: string) => string;
  sectionTitle: string;
  axisXLabel: string;
  axisYLabel: string;
  legendConservative: string;
  legendBold: string;
  legendOther: string;
  legendStripShown: string;
  legendStripHidden: string;
  correlationLabel: (r: string) => string;
  trendLabel: (slope: string, intercept: string, interceptSign: string) => string;
  insufficientLabel: string;
  boxCountLabel: (n: number) => string;
  boxInsufficientLabel: string;
}

export function StatScatterGrid({
  rows,
  audienceFilter,
  audienceIncludesPlayers,
  axisLabel,
  pairTitle,
  boxTitle,
  sectionTitle,
  axisXLabel,
  axisYLabel,
  legendConservative,
  legendBold,
  legendOther,
  legendStripShown,
  legendStripHidden,
  correlationLabel,
  trendLabel,
  insufficientLabel,
  boxCountLabel,
  boxInsufficientLabel
}: StatScatterGridProps): ReactElement {
  const [xKey, setXKey] = useState<NumericStatKey>("failCount");
  const [yKey, setYKey] = useState<NumericStatKey>("currentFloor");

  const sameAxis = xKey === yKey;

  const boxGroupLabels = useMemo(
    () => ({
      stripShown: legendStripShown,
      stripHidden: legendStripHidden,
      conservative: legendConservative,
      bold: legendBold
    }),
    [legendStripShown, legendStripHidden, legendConservative, legendBold]
  );

  const boxLegendGroups = useMemo(
    () => buildBoxPlotGroups(rows, xKey, audienceFilter, boxGroupLabels),
    [rows, xKey, audienceFilter, boxGroupLabels]
  );

  return (
    <section className={styles.scatterSection}>
      <h3 className={styles.scatterSectionTitle}>{sectionTitle}</h3>

      <div className={styles.scatterControls}>
        <label className={styles.scatterControl}>
          <span className={styles.scatterControlLabel}>{axisXLabel}</span>
          <select
            className={styles.scatterSelect}
            value={xKey}
            onChange={(ev) => setXKey(ev.target.value as NumericStatKey)}
          >
            {NUMERIC_STAT_KEYS.map((key) => (
              <option key={key} value={key}>
                {axisLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.scatterControl}>
          <span className={styles.scatterControlLabel}>{axisYLabel}</span>
          <select
            className={styles.scatterSelect}
            value={yKey}
            onChange={(ev) => setYKey(ev.target.value as NumericStatKey)}
          >
            {NUMERIC_STAT_KEYS.map((key) => (
              <option key={key} value={key}>
                {axisLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sameAxis ? (
        boxLegendGroups.length > 0 ? (
          <ul className={styles.scatterLegend}>
            {boxLegendGroups.map((g) => (
              <li key={g.id}>
                <span
                  className={styles.scatterLegendDot}
                  style={{ background: g.color }}
                  aria-hidden
                />
                {g.label}
              </li>
            ))}
          </ul>
        ) : null
      ) : (
        <ul className={styles.scatterLegend}>
          <li>
            <span className={styles.dotConservative} aria-hidden />
            {legendConservative}
          </li>
          <li>
            <span className={styles.dotBold} aria-hidden />
            {legendBold}
          </li>
          <li>
            <span className={styles.dotOther} aria-hidden />
            {legendOther}
          </li>
          {audienceIncludesPlayers ? (
            <>
              <li>
                <span className={styles.dotStripShown} aria-hidden />
                {legendStripShown}
              </li>
              <li>
                <span className={styles.dotStripHidden} aria-hidden />
                {legendStripHidden}
              </li>
            </>
          ) : null}
        </ul>
      )}

      <div className={styles.scatterSingle}>
        {sameAxis ? (
          <StatBoxPlot
            rows={rows}
            audienceFilter={audienceFilter}
            valueKey={xKey}
            valueLabel={axisLabel(xKey)}
            title={boxTitle(axisLabel(xKey))}
            groupLabels={boxGroupLabels}
            countLabel={boxCountLabel}
            insufficientLabel={boxInsufficientLabel}
          />
        ) : (
          <StatScatterPlot
            rows={rows}
            xKey={xKey}
            yKey={yKey}
            xLabel={axisLabel(xKey)}
            yLabel={axisLabel(yKey)}
            title={pairTitle(xKey, yKey)}
            correlationLabel={correlationLabel}
            trendLabel={trendLabel}
            insufficientLabel={insufficientLabel}
            large
          />
        )}
      </div>
    </section>
  );
}
