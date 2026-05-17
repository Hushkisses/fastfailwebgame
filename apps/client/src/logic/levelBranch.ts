import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
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

/** 서버 `LevelBranchGenerator`와 동일한 결정적 XOR 트리 */
export class LevelBranchGenerator {
  private branches = new Map<number, Branch>();
  private roundSeed = 0;

  setRoundSeed(seed: number): void {
    const s = Math.floor(seed) >>> 0;
    if (s === this.roundSeed && this.branches.size > 0) return;
    this.roundSeed = s;
    this.branches.clear();
  }

  getRoundSeed(): number {
    return this.roundSeed;
  }

  precomputeAll(): void {
    for (let level = 1; level <= CLIENT_GOAL_FLOOR; level++) {
      this.getBranch(level);
    }
  }

  private rollForLevel(level: number): number {
    return seeded01(level * 31.917 + level * level * 3.019 + this.roundSeed * 97.313);
  }

  public getBranch(level: number): Branch {
    if (level < 1) {
      return { leftSafe: true, rightSafe: false };
    }

    const found = this.branches.get(level);
    if (found) return found;

    const roll = this.rollForLevel(level);
    const leftSafe = roll < branchBalance.safeSideLeftChance;
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

  public clearBranches(): void {
    this.branches.clear();
  }
}
