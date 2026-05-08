import { branchBalance } from "../config/gameBranchBalance";

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
  const raw = branchBalance.trapBaseChance + level * branchBalance.trapPerFloorRaise;
  return Math.min(0.68, Math.max(0.18, raw));
}

/** 서버 `LevelBranchGenerator`와 동일한 결정적 XOR 트리 */
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

    if (this.branches.size > branchBalance.maxBranchDepth) {
      const oldest = Math.min(...this.branches.keys());
      this.branches.delete(oldest);
    }

    return branch;
  }

  public isChoiceSafe(level: number, side: Side): boolean {
    const b = this.getBranch(level);
    return side === "left" ? b.leftSafe : b.rightSafe;
  }
}
