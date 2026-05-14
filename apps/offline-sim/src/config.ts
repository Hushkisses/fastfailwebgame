import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ThinkMsSpec =
  | { type: "uniform"; min: number; max: number }
  | { type: "normal"; mean: number; sd: number; min: number; max: number };

export interface SimGroupConfig {
  id: string;
  label: string;
  count: number;
  thinkMs: ThinkMsSpec;
  /** 0~1, 한 번의 행동 사이클에서 힌트를 시도할 확률(쿨다운이 비었을 때만 성공) */
  hintBaseChance: number;
  /** 현재 층에 유효한 힌트가 있을 때 think 시간에 곱할 배율(작을수록 빨리 움직임) */
  afterHintThinkScale: number;
  /** true면 한 칸씩만 이동(점프력이 있어도 path 길이 1). 생략 시 false */
  preferSingleStep?: boolean;
}

export interface SimConfigFile {
  seed: number;
  /** 결과 CSV/JSON/HTML을 쓸 디렉터리 (설정 JSON 파일이 있는 폴더 기준 상대 경로) */
  outputDir: string;
  maxStepsPerRun: number;
  groups: SimGroupConfig[];
}

export function loadSimConfig(path: string): SimConfigFile {
  const abs = resolve(path);
  const raw = readFileSync(abs, "utf8");
  const j = JSON.parse(raw) as SimConfigFile;
  if (!j.groups?.length) throw new Error("sim-config: groups 가 비었습니다.");
  for (const g of j.groups) {
    if (!g.id || !g.label) throw new Error(`sim-config: 그룹 id/label 필수 (${JSON.stringify(g)})`);
    if (!Number.isFinite(g.count) || g.count < 1) throw new Error(`sim-config: count >= 1 (${g.id})`);
    validateThinkMs(g.thinkMs, g.id);
    if (!Number.isFinite(g.hintBaseChance) || g.hintBaseChance < 0 || g.hintBaseChance > 1) {
      throw new Error(`sim-config: hintBaseChance 0~1 (${g.id})`);
    }
    if (!Number.isFinite(g.afterHintThinkScale) || g.afterHintThinkScale <= 0) {
      throw new Error(`sim-config: afterHintThinkScale > 0 (${g.id})`);
    }
    g.preferSingleStep = g.preferSingleStep ?? false;
  }
  if (!Number.isFinite(j.seed)) j.seed = Date.now();
  j.outputDir = typeof j.outputDir === "string" ? j.outputDir : "out";
  j.maxStepsPerRun = Number.isFinite(j.maxStepsPerRun) ? Math.max(1000, j.maxStepsPerRun) : 250_000;
  return j;
}

function validateThinkMs(t: ThinkMsSpec, gid: string): void {
  if (t.type === "uniform") {
    if (t.min > t.max || t.min < 0) throw new Error(`sim-config: thinkMs uniform (${gid})`);
  } else if (t.type === "normal") {
    if (t.min > t.max || t.min < 0) throw new Error(`sim-config: thinkMs normal (${gid})`);
  } else throw new Error(`sim-config: thinkMs type (${gid})`);
}
