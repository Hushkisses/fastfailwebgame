import { Application, Container, Graphics, Text } from "pixi.js";
import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import type { PickTarget, Side } from "../logic/pickPath";
import { drawSideGlassSlab } from "./drawGlass";
import { ISO_FRONT_DEPTH, ISO_TOP_HW, ISO_TOP_HV, tileWorldCenter } from "./sidescrollLayout";
import { TowerWorldView, type TowerSyncInput } from "./TowerWorldView";

export type { GhostPlayerMini, TowerSyncInput } from "./TowerWorldView";
export type { PickTarget } from "../logic/pickPath";
export { drawTile } from "./drawTowerTile";

export interface ClimbHudModel {
  floor: number;
  runPeakFloor: number;
  bestFloorReached: number;
  failEnergy: number;
  jumpPower: number;
  moveSpeed: number;
  auraTier: string;
  hasWon: boolean;
  /** 서버 시간 기준 타일 선택 허용 시각 (unix ms); 0이면 제한 없음 */
  respawnAvailableAt: number;
}

/** HUD 보조 플래그(구 큐브 UI 대체: 실제 클릭은 pickLayer) */
export interface PickHighlights {
  leftEnabled: boolean;
  rightEnabled: boolean;
}

const MAX_PICK_SLOTS = 200;

export class ClimbStage {
  private readonly towerView: TowerWorldView;
  private readonly root = new Container();
  private readonly title: Text;
  private readonly stats: Text;
  /** 구형 L/R 큐브 — 비표시(다열 픽으로 대체) */
  private readonly leftWrap = new Container();
  private readonly rightWrap = new Container();
  private readonly leftGlow = new Graphics();
  private readonly leftFoot = new Graphics();
  private readonly leftCube = new Graphics();
  private readonly rightGlow = new Graphics();
  private readonly rightFoot = new Graphics();
  private readonly rightCube = new Graphics();
  private readonly leftCap = new Text({ text: "L", style: { fill: 0xffffff, fontSize: 22, fontWeight: "700" } });
  private readonly rightCap = new Text({ text: "R", style: { fill: 0xffffff, fontSize: 22, fontWeight: "700" } });
  private readonly hudSpine = new Graphics();
  private readonly pickLayer = new Container();
  private readonly pickSlots: Graphics[] = [];

  private onPickPathHandler: ((path: Side[]) => void) | null = null;
  private pulsePhase = 0;
  private hudRef: PickHighlights | null = null;
  private activePickCount = 0;

  private readonly leftTint = 0x6aa6ff;
  private readonly rightTint = 0xff8f6a;

  constructor(private readonly app: Application) {
    this.title = new Text({ text: "", style: { fill: 0xf2f5ff, fontSize: 18, fontWeight: "600" } });
    this.stats = new Text({
      text: "",
      style: { fill: 0xc8d2f5, fontSize: 13, lineHeight: 18 }
    });
    this.title.position.set(16, 16);
    this.stats.position.set(16, 48);

    this.leftCap.anchor.set(0.5, 1.35);
    this.leftCap.position.set(0, -8);
    this.rightCap.anchor.set(0.5, 1.35);
    this.rightCap.position.set(0, -8);

    this.leftWrap.sortableChildren = true;
    this.rightWrap.sortableChildren = true;
    this.leftGlow.zIndex = 0;
    this.leftFoot.zIndex = 1;
    this.leftCube.zIndex = 2;
    this.leftCap.zIndex = 3;
    this.rightGlow.zIndex = 0;
    this.rightFoot.zIndex = 1;
    this.rightCube.zIndex = 2;
    this.rightCap.zIndex = 3;

    this.leftWrap.addChild(this.leftGlow, this.leftFoot, this.leftCube, this.leftCap);
    this.rightWrap.addChild(this.rightGlow, this.rightFoot, this.rightCube, this.rightCap);

    this.leftCube.clear();
    this.rightCube.clear();

    drawSideGlassSlab(this.leftCube, 0, 0, 58, 128, this.leftTint, { glow: 0.12 });
    drawSideGlassSlab(this.rightCube, 0, 0, 58, 128, this.rightTint, { glow: 0.12 });

    this.leftWrap.visible = false;
    this.rightWrap.visible = false;

    this.towerView = new TowerWorldView(app);
    this.hudSpine.zIndex = 100;
    this.pickLayer.zIndex = 60;
    this.root.sortableChildren = true;
    this.root.addChild(this.title, this.stats, this.hudSpine);
    this.towerView.worldRoot.addChild(this.leftWrap, this.rightWrap, this.pickLayer);
    this.worldRootInteractiveSort();

    this.app.stage.addChild(this.towerView.worldRoot, this.root);

    for (let i = 0; i < MAX_PICK_SLOTS; i++) {
      const g = new Graphics();
      g.eventMode = "static";
      g.visible = false;
      this.pickLayer.addChild(g);
      this.pickSlots.push(g);
    }

    this.layout(window.innerWidth, window.innerHeight);
    this.app.ticker.add(this.onTick);
  }

  private worldRootInteractiveSort(): void {
    this.towerView.worldRoot.sortableChildren = true;
  }

  handleRemoteFall(remoteId: string, fromFloor: number, side: "left" | "right", nowMs?: number): void {
    this.towerView.handleRemoteFall(remoteId, fromFloor, side, nowMs);
  }

  triggerLocalGlassBreak(floor: number, side: "left" | "right"): void {
    this.towerView.triggerLocalGlassBreak(floor, side);
  }

  syncWorld(inp: TowerSyncInput): void {
    const pulse = (Math.sin(this.pulsePhase) + 1) * 0.5;
    this.towerView.sync(inp, pulse);

    const targets = inp.pickTargets ?? [];
    this.activePickCount = Math.min(targets.length, this.pickSlots.length);

    for (let i = 0; i < this.pickSlots.length; i++) {
      const g = this.pickSlots[i]!;
      g.removeAllListeners();
      if (i >= this.activePickCount) {
        g.visible = false;
        g.clear();
        g.eventMode = "none";
        continue;
      }

      const t = targets[i]!;
      const p = tileWorldCenter(t.floor, t.side);
      g.position.set(p.x, p.y);
      g.visible = true;
      g.eventMode = "static";
      g.cursor = "pointer";

      const pathCopy = [...t.path];
      g.on("pointerdown", () => {
        if (pathCopy.length) this.onPickPathHandler?.(pathCopy);
      });
    }
  }

  private onTick = (): void => {
    this.pulsePhase += 0.06;
    if (!this.hudRef) return;
    const wobble = (Math.sin(this.pulsePhase) + 1) * 0.5;
    const alpha = 0.2 + wobble * 0.42;
    for (let i = 0; i < this.activePickCount; i++) {
      const g = this.pickSlots[i]!;
      const hitW = ISO_TOP_HW * 2 + 36;
      const hitH = ISO_TOP_HV * 2 + ISO_FRONT_DEPTH + 32;
      g.clear();
      g.roundRect(-hitW / 2, -ISO_TOP_HV - 14, hitW, hitH, 14).fill({ color: 0xffffff, alpha: 0.03 });
      g.roundRect(-hitW / 2 - 4 - wobble * 2, -ISO_TOP_HV - 18 - wobble * 2, hitW + 8 + wobble * 4, hitH + 12 + wobble * 4, 16).stroke({
        width: 2.2,
        color: 0xfff8e8,
        alpha
      });
    }
    this.drawHighlightRing(this.leftGlow, this.hudRef.leftEnabled);
    this.drawHighlightRing(this.rightGlow, this.hudRef.rightEnabled);
  };

  private drawHighlightRing(g: Graphics, active: boolean): void {
    g.clear();
    if (!active) return;
    const wobble = (Math.sin(this.pulsePhase) + 1) * 0.5;
    const alpha = 0.22 + wobble * 0.45;
    const expand = 4 + wobble * 6;
    const rw = ISO_TOP_HW * 2 + 20;
    const rh = ISO_TOP_HV * 2 + ISO_FRONT_DEPTH + 24;
    g.roundRect(-rw / 2 - expand, -rh / 2 - expand - 6, rw + expand * 2, rh + expand * 2, 14).stroke({
      width: 2.4,
      color: 0xffffff,
      alpha
    });
    void alpha;
  }

  layout(width: number, height: number): void {
    this.worldW = width;
    this.worldH = height;
    this.hudSpine.clear();
    const cx = width * 0.5;
    this.hudSpine.moveTo(cx, 0).lineTo(cx, height).stroke({ width: 1.4, color: 0xfff7ff, alpha: 0.14 });
    this.hudSpine.moveTo(cx, 0).lineTo(cx, height).stroke({ width: 4, color: 0xffffff, alpha: 0.04 });
  }

  private worldW = typeof window !== "undefined" ? window.innerWidth : 960;
  private worldH = typeof window !== "undefined" ? window.innerHeight : 540;

  setHud(model: ClimbHudModel, picks: PickHighlights): void {
    this.hudRef = picks;
    const win = model.hasWon ? "\n★ 목표 층 도달! 승리 ★" : "";
    const nowTs = Date.now();
    const wait =
      model.respawnAvailableAt > nowTs ? Math.ceil((model.respawnAvailableAt - nowTs) / 100) / 10 : 0;
    const revive = wait > 0 ? `\n⏳ 데이터 복구·부활 대기 (${wait}s)` : "";
    this.title.text = `유리 다리 · ${model.floor} / ${CLIENT_GOAL_FLOOR}`;
    this.stats.text = [
      `실패 에너지: ${model.failEnergy.toFixed(1)}`,
      `점프 층수: ${model.jumpPower} · 속도: ${model.moveSpeed.toFixed(1)}`,
      `이번 런 피크: ${model.runPeakFloor}F · 통산 최고: ${model.bestFloorReached}F`,
      `오라: ${model.auraTier}${win}${revive}`
    ].join("\n");
  }

  onPick(cb: (path: Side[]) => void): void {
    this.onPickPathHandler = cb;
  }
}
