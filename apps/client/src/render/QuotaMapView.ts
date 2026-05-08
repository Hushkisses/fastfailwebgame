import { Application, Container, Graphics, Point } from "pixi.js";
import { TILE_HEIGHT, TILE_DEPTH, TILE_WIDTH } from "../map/constants";
import { estimateGridElevatedBounds, gridToScreen } from "../map/gridToScreen";
import type { Tile } from "../map/tile";
import { QUOTA_COLS, QUOTA_ROWS } from "../map/buildGrid";
import { downBranchNeighbors } from "../map/vPath";
import { drawTile } from "./drawQuotaTile";

interface CellCoord {
  row: number;
  col: number;
  zKey: number;
}

export interface PlayerDrawCtx {
  screenX: number;
  screenY: number;
  /** 진행 중일 때 라디얼 브리딩 표시 등 (0~1). */
  fallProgress?: number;
}

/**
 * 입체 타일 그리드를 row+col 정렬 순으로 그린 후 엔티티 레이어에 플레이어를 얹음.
 */
export class QuotaMapView {
  private readonly root = new Container();
  private readonly tileLayer = new Container();
  private readonly entityLayer = new Container();
  private readonly layer = new Container();

  constructor(private readonly app: Application) {
    this.layer.addChild(this.tileLayer, this.entityLayer);
    this.root.addChild(this.layer);
    this.app.stage.addChild(this.root);
  }

  syncSize(cssWidth: number, cssHeight: number, grid: Tile[][]): void {
    const bounds = estimateGridElevatedBounds(grid);
    this.layer.position.set(
      cssWidth * 0.5 - bounds.centerX,
      cssHeight * 0.5 - bounds.centerY
    );
  }

  draw(grid: Tile[][], player: PlayerDrawCtx | null): void {
    this.tileLayer.removeChildren();
    const cells: CellCoord[] = [];
    for (let row = 0; row < QUOTA_ROWS; row += 1) {
      for (let col = 0; col < QUOTA_COLS; col += 1) {
        cells.push({ row, col, zKey: row + col });
      }
    }

    cells.sort((a, b) => a.zKey - b.zKey);

    for (const { row, col } of cells) {
      const tile = grid[row][col];
      const { x, y } = gridToScreen(col, row);
      const g = new Graphics();
      const topTint = tintForSurface(tile);
      drawTile(g, x, y, tile.height, topTint, tile);
      this.tileLayer.addChild(g);
    }

    this.entityLayer.removeChildren();
    if (player != null) {
      const puck = new Graphics();
      puck
        .circle(0, 0, 9)
        .fill(0xfff6e8)
        .stroke({
          width: player.fallProgress != null && player.fallProgress > 0 ? 2 + player.fallProgress * 5 : 2,
          color: 0x5cc8ff,
          alpha: 0.9
        });
      puck.position.set(player.screenX, player.screenY - 18);
      this.entityLayer.addChild(puck);
    }
  }

  /**
   * 캔버스 좌표를 타일 셀로 변환 (앞쪽부터 히트).
   */
  pickCell(clientX: number, clientY: number, grid: Tile[][]): { row: number; col: number } | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.app.renderer.width / Math.max(1, rect.width));
    const sy = (clientY - rect.top) * (this.app.renderer.height / Math.max(1, rect.height));
    const global = new Point(sx, sy);
    const local = new Point();
    this.tileLayer.toLocal(global, undefined, local);

    const hh = TILE_HEIGHT / 2;
    const hw = TILE_WIDTH / 2;

    const ordered: CellCoord[] = [];
    for (let row = 0; row < QUOTA_ROWS; row += 1) {
      for (let col = 0; col < QUOTA_COLS; col += 1) {
        ordered.push({ row, col, zKey: row + col });
      }
    }
    ordered.sort((a, b) => b.zKey - a.zKey);

    for (const { row, col } of ordered) {
      const t = grid[row][col];
      const { x: cx, y: baseY } = gridToScreen(col, row);
      const cy = baseY - Math.max(0, t.height) * TILE_DEPTH;
      if (diamondContain(local.x, local.y, cx, cy, hw, hh, 1.12)) return { row, col };
    }
    return null;
  }

  neighborsFrom(playerRow: number, playerCol: number): readonly [{ row: number; col: number }, { row: number; col: number }] {
    const [a, b] = downBranchNeighbors(playerRow, playerCol);
    return [
      { row: a[0], col: a[1] },
      { row: b[0], col: b[1] }
    ];
  }

  elevatedAnchor(grid: Tile[][], row: number, col: number): { x: number; y: number } {
    const t = grid[row][col];
    const { x, y } = gridToScreen(col, row);
    return { x, y: y - Math.max(0, t.height) * TILE_DEPTH };
  }

}

function tintForSurface(tile: Tile): number {
  if (tile.type === "safe") return 0x4a9865;
  if (tile.isRevealed) return 0x6b4860;
  return 0x4d5a73;
}

function diamondContain(px: number, py: number, cx: number, cy: number, hw: number, hh: number, pad: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return Math.abs(dx) / hw + Math.abs(dy) / hh <= pad;
}
