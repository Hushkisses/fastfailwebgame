import { CUBE_WALL_DROP, TILE_DEPTH, TILE_HEIGHT, TILE_WIDTH } from "./constants";

import type { Tile } from "./tile";



/**

 * 규격: screenX = (col - row) * (TW/2), screenY = (col + row) * (TH/2)

 */

export function gridToScreen(col: number, row: number): { x: number; y: number } {

  return {

    x: (col - row) * (TILE_WIDTH / 2),

    y: (col + row) * (TILE_HEIGHT / 2)

  };

}



export interface GridBounds {

  minX: number;

  maxX: number;

  minY: number;

  maxY: number;

  centerX: number;

  centerY: number;

}



const hw = TILE_WIDTH / 2;

const hh = TILE_HEIGHT / 2;



/**

 * height·육면체 옆면까지 포함해 맵 바운딩 (중앙 정렬).

 */

export function estimateGridElevatedBounds(grid: Tile[][]): GridBounds {

  let minX = Infinity;

  let maxX = -Infinity;

  let minY = Infinity;

  let maxY = -Infinity;



  grid.forEach((row, ri) =>

    row.forEach((tile, ci) => {

      const c = gridToScreen(ci, ri);

      const cyTopCenter = c.y - Math.max(0, tile.height) * TILE_DEPTH;

      minX = Math.min(minX, c.x - hw, c.x + hw);

      maxX = Math.max(maxX, c.x - hw, c.x + hw);

      minY = Math.min(minY, cyTopCenter - hh);

      maxY = Math.max(maxY, cyTopCenter + hh + CUBE_WALL_DROP);

    })

  );



  const centerX = (minX + maxX) / 2;

  const centerY = (minY + maxY) / 2;



  return { minX, maxX, minY, maxY, centerX, centerY };

}


