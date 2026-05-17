import { createElement, type ReactElement } from "react";
import { RECENT_TILE_CHOICE_COUNT, TILE_LANE_COLORS } from "../../../config/tileLaneColors";
import type { TileChoiceSide } from "../../../state/recentTileChoices";
import styles from "./ClimbHud.module.css";

export interface RecentTileStripProps {
  choices: readonly TileChoiceSide[];
  label: string;
  ariaLeft: string;
  ariaRight: string;
  ariaEmpty: string;
  /** 최근 선택 UI 코호트에만 표시 (좌/우 정답 비율 안내) */
  ratioHint?: string;
}

export function RecentTileStrip({
  choices,
  label,
  ariaLeft,
  ariaRight,
  ariaEmpty,
  ratioHint
}: RecentTileStripProps): ReactElement {
  const cells: (TileChoiceSide | null)[] = [];
  for (let i = 0; i < RECENT_TILE_CHOICE_COUNT; i++) {
    cells.push(choices[i] ?? null);
  }

  const aria = cells
    .map((c) => (c === "left" ? ariaLeft : c === "right" ? ariaRight : ariaEmpty))
    .join(", ");

  return createElement(
    "div",
    { className: styles.recentBlock },
    createElement("div", { className: styles.recentLabel }, label),
    createElement(
      "div",
      { className: styles.recentStrip, role: "img", "aria-label": aria },
      ...cells.map((side, i) =>
        createElement("div", {
          key: i,
          className: styles.recentCell,
          style: {
            backgroundColor:
              side === "left"
                ? TILE_LANE_COLORS.left
                : side === "right"
                  ? TILE_LANE_COLORS.right
                  : TILE_LANE_COLORS.empty
          },
          title: side === "left" ? ariaLeft : side === "right" ? ariaRight : undefined
        })
      )
    ),
    ratioHint ? createElement("p", { className: styles.recentRatioHint }, ratioHint) : null
  );
}
