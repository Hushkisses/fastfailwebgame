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

/**
 * 해당 층에서 좌/우 선택지 — 항상 한쪽 안전 / 한쪽 함정 XOR.
 * 라운드 시드 기준으로 좌측 안전 확률 = `safeSideLeftChance` (기본 0.6).
 */
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

  /** 1..goalFloor 분기를 미리 생성 (라운드 시작 시 호출). */
  precomputeAll(): void {
    for (let level = 1; level <= gameBalance.goalFloor; level++) {
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
    const leftSafe = roll < gameBalance.safeSideLeftChance;
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
