import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import { trapRevealKeyClient } from "./trapKeys";
import type { LevelBranchGenerator, Side } from "./levelBranch";

export type { Side } from "./levelBranch";

export interface PickTarget {
  /** 서버 `player.floor` 기준 선택지가 있는 열(층 번호) */
  floor: number;
  side: Side;
  /** 서버에 보낼 경로 (길이 = 전진 칸 수) */
  path: Side[];
}

/**
 * 슬롯(열 `startFloor+offset`, 마지막 스텝 패널 `side`)에 해당하는
 * 길이 `offset+1`의 경로 하나.
 * - 중간 스텝은 XOR상 **반드시 안전패널**만 (함정으로는 지나가지 않음).
 * - **마지막 스텝만** 안전 또는 함정 허용(실패 패널도 눌러 게임 규칙대로 추락 가능).
 */
export function inferPathForSlot(
  gen: LevelBranchGenerator,
  startFloor: number,
  offset: number,
  side: Side,
  trapKnown: Set<string>
): Side[] | null {
  const hops = offset + 1;

  function dfs(prefix: Side[]): Side[] | null {
    const step = prefix.length;
    if (step === hops) {
      return prefix[hops - 1] === side ? prefix : null;
    }
    const fAt = startFloor + step;
    const finalHop = step === hops - 1;
    const choices: Side[] = finalHop ? [side] : ["left", "right"];
    for (const s of choices) {
      const key = trapRevealKeyClient(fAt, s);
      if (trapKnown.has(key)) continue;
      if (!finalHop && !gen.isChoiceSafe(fAt, s)) continue;
      const found = dfs([...prefix, s]);
      if (found) return found;
    }
    return null;
  }

  return dfs([]);
}

/** 점프력 JP: `startFloor .. startFloor+JP-1` 열의 L/R 중 도달 가능한 슬롯만 반환 */
export function buildPickTargets(
  gen: LevelBranchGenerator,
  startFloor: number,
  jumpPower: number,
  trapKnown: Set<string>
): PickTarget[] {
  const jp = Math.max(1, Math.floor(jumpPower));
  const out: PickTarget[] = [];
  for (let offset = 0; offset < jp; offset++) {
    const col = startFloor + offset;
    /** 착지 층 = startFloor + (offset+1); 목표 초과 패널은 선택 불가 */
    if (startFloor + offset + 1 > CLIENT_GOAL_FLOOR) continue;
    for (const side of ["left", "right"] as const) {
      /** 출발 패널이 이미 함정으로 알려져 있으면 픽 자체를 만들지 않음 */
      const startKey = trapRevealKeyClient(col, side);
      if (trapKnown.has(startKey)) continue;
      /**
       * 시각상 픽 슬롯은 "착지 발판"(col + 1) 위에 놓이므로,
       * 착지 발판이 이미 함정/깨진 발판으로 알려진 경우에도 픽을 제외해야
       * 깨진 발판 위에 hit 영역이 깔리는 모순이 없다.
       */
      const landingKey = trapRevealKeyClient(col + 1, side);
      if (trapKnown.has(landingKey)) continue;
      const path = inferPathForSlot(gen, startFloor, offset, side, trapKnown);
      if (path) out.push({ floor: col, side, path });
    }
  }
  return out;
}
