import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  /** 현재 층 (1 ≈ 시작) */
  @type("number") floor = 1;
  @type("string") currentSide = "left";
  /** 이번 런에서 도달한 최고 층 (실패 보상 기준) */
  @type("number") runPeakFloor = 1;
  /** 통산 최고 층 (전광판·기록) */
  @type("number") bestFloorReached = 1;
  @type("number") failCount = 0;
  /** 누적 실패 에너지 — 승부의 핵심 스탯 */
  @type("number") failEnergy = 0;
  @type("number") jumpPower = 1;
  @type("number") moveSpeed = 4;
  @type("string") auraTier = "blue";
  @type("number") lastHintAt = 0;
  @type("boolean") hasWon = false;
  /** 밝혀진 함정: "층|left|right" 형식 — 해당 층에서 그 선택은 영구 비활성 */
  @type(["string"]) revealedTrapKeys = new ArraySchema<string>();
  /** 이 시각(ms) 이전까지 타일 선택 불가 (추락 후 부활 대기) */
  @type("number") respawnAvailableAt = 0;
}

export class TrailMark extends Schema {
  @type("number") floor = 1;
  @type("string") side = "left";
  @type("number") timestamp = 0;
}

export class HintResult extends Schema {
  @type("number") floor = 1;
  @type("string") safeSide = "left";
  @type("number") expiresAt = 0;
}

/** 라운드 종료 시점 스냅샷 (관리자 통계창용) */
export class RoundStatEntry extends Schema {
  @type("string") name = "";
  @type("number") bestFloorReached = 1;
  @type("number") failEnergy = 0;
  @type("boolean") hasWon = false;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([TrailMark]) trails = new ArraySchema<TrailMark>();
  @type({ map: HintResult }) hints = new MapSchema<HintResult>();
  /** "waiting" | "playing" | "ended" — 관리자 시작 전·종료 후에는 타일·힌트 비활성 */
  @type("string") matchPhase = "waiting";
  @type([RoundStatEntry]) lastRoundStats = new ArraySchema<RoundStatEntry>();
}
