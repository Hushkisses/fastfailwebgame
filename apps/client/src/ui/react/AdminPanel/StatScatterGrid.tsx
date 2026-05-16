import type { ReactElement } from "react";
import { useState } from "react";
import type { StatRowView } from "./statTypes";
import { allNumericStatPairs, primaryStatPairs, type NumericStatKey } from "./statScatter";
import { StatScatterPlot } from "./StatScatterPlot";
import styles from "./AdminPanel.module.css";

export interface StatScatterGridProps {
  rows: StatRowView[];
  axisLabel: (key: NumericStatKey) => string;
  pairTitle: (xKey: NumericStatKey, yKey: NumericStatKey) => string;
  sectionTitle: string;
  sectionHint: string;
  showAllLabel: string;
  showLessLabel: string;
  legendConservative: string;
  legendBold: string;
  legendOther: string;
}

export function StatScatterGrid({
  rows,
  axisLabel,
  pairTitle,
  sectionTitle,
  sectionHint,
  showAllLabel,
  showLessLabel,
  legendConservative,
  legendBold,
  legendOther
}: StatScatterGridProps): ReactElement {
  const [showAll, setShowAll] = useState(false);
  const pairs = showAll ? allNumericStatPairs() : primaryStatPairs();

  return (
    <section className={styles.scatterSection}>
      <div className={styles.scatterSectionHead}>
        <h3 className={styles.scatterSectionTitle}>{sectionTitle}</h3>
        <button
          type="button"
          className={styles.scatterToggle}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? showLessLabel : showAllLabel}
        </button>
      </div>
      <p className={styles.sortHint}>{showAll ? sectionHint : ""}</p>
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
      </ul>
      <div className={styles.scatterGrid}>
        {pairs.map(([xKey, yKey]) => (
          <StatScatterPlot
            key={`${xKey}-${yKey}`}
            rows={rows}
            xKey={xKey}
            yKey={yKey}
            xLabel={axisLabel(xKey)}
            yLabel={axisLabel(yKey)}
            title={pairTitle(xKey, yKey)}
          />
        ))}
      </div>
    </section>
  );
}
