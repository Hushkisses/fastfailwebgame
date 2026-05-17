import type { ReactElement } from "react";
import { useState } from "react";
import type { StatRowView } from "./statTypes";
import { NUMERIC_STAT_KEYS, type NumericStatKey } from "./statScatter";
import { StatScatterPlot } from "./StatScatterPlot";
import styles from "./AdminPanel.module.css";

export interface StatScatterGridProps {
  rows: StatRowView[];
  axisLabel: (key: NumericStatKey) => string;
  pairTitle: (xKey: NumericStatKey, yKey: NumericStatKey) => string;
  sectionTitle: string;
  axisXLabel: string;
  axisYLabel: string;
  sameAxisError: string;
  legendConservative: string;
  legendBold: string;
  legendOther: string;
  legendStripShown: string;
  legendStripHidden: string;
}

export function StatScatterGrid({
  rows,
  axisLabel,
  pairTitle,
  sectionTitle,
  axisXLabel,
  axisYLabel,
  sameAxisError,
  legendConservative,
  legendBold,
  legendOther,
  legendStripShown,
  legendStripHidden
}: StatScatterGridProps): ReactElement {
  const [xKey, setXKey] = useState<NumericStatKey>("failCount");
  const [yKey, setYKey] = useState<NumericStatKey>("currentFloor");

  const sameAxis = xKey === yKey;

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
        <li>
          <span className={styles.dotStripShown} aria-hidden />
          {legendStripShown}
        </li>
        <li>
          <span className={styles.dotStripHidden} aria-hidden />
          {legendStripHidden}
        </li>
      </ul>

      {sameAxis ? (
        <p className={styles.scatterError} role="alert">
          {sameAxisError}
        </p>
      ) : (
        <div className={styles.scatterSingle}>
          <StatScatterPlot
            rows={rows}
            xKey={xKey}
            yKey={yKey}
            xLabel={axisLabel(xKey)}
            yLabel={axisLabel(yKey)}
            title={pairTitle(xKey, yKey)}
            large
          />
        </div>
      )}
    </section>
  );
}
