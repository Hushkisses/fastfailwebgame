import { gameBalance } from "../config/gameBalance.js";



export type Side = "left" | "right";



export interface Branch {

  leftSafe: boolean;

  rightSafe: boolean;

}



function seeded01(seed: number): number {

  const x = Math.sin(seed * 17.917 + 92.413) * 9999.971;

  return x - Math.floor(x);

}



function clampTrapBias(level: number): number {

  const raw = gameBalance.trapBaseChance + level * gameBalance.trapPerFloorRaise;

  return Math.min(0.68, Math.max(0.18, raw));

}



/**

 * 해당 층에서 좌/우 선택지 — 항상 한쪽 안전 / 한쪽 함정 XOR.

 */

export class LevelBranchGenerator {

  private branches = new Map<number, Branch>();



  public getBranch(level: number): Branch {

    if (level < 1) {

      return { leftSafe: true, rightSafe: false };

    }

    const found = this.branches.get(level);

    if (found) return found;

    const trapBias = clampTrapBias(level);

    const roll = seeded01(level * 31.917 + level * level * 3.019);

    const leftSafe = roll > trapBias;

    const branch: Branch = {

      leftSafe,

      rightSafe: !leftSafe

    };

    this.branches.set(level, branch);

    if (this.branches.size > gameBalance.maxBranchDepth) {

      const oldest = Math.min(...this.branches.keys());

      this.branches.delete(oldest);

    }

    return branch;

  }



  public isChoiceSafe(level: number, side: Side): boolean {

    const branch = this.getBranch(level);

    return side === "left" ? branch.leftSafe : branch.rightSafe;

  }

  /** 라운드 재시작 시 함정 분기를 새로 뽑기 위해 캐시를 비웁니다. */
  public clearBranches(): void {
    this.branches.clear();
  }

}


