import { Application, Container, Graphics, Text } from "pixi.js";
import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import type { PickTarget, Side } from "../logic/pickPath";
import { drawSideGlassSlab } from "./drawGlass";
import { ISO_FRONT_DEPTH, ISO_TOP_HW, ISO_TOP_HV, tileWorldPos } from "./sidescrollLayout";
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
  private readonly pickSlots: { wrap: Container; hit: Graphics; cap: Text }[] = [];
  private readonly vignette = new Graphics();

  private onPickPathHandler: ((path: Side[]) => void) | null = null;
  private pulsePhase = 0;
  private hudRef: PickHighlights | null = null;
  private activePickCount = 0;
  /** onTick 네온 색 — 픽 타일별 좌측 여부 */
  private pickIsLeft: boolean[] = [];

  private readonly leftTint = 0x6aa6ff;
  private readonly rightTint = 0xff8f6a;

  constructor(private readonly app: Application) {
    this.title = new Text({
      text: "",
      style: { fill: 0x8899aa, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }
    });
    this.stats = new Text({
      text: "",
      style: { fill: 0x556070, fontSize: 9, lineHeight: 12 }
    });
    this.title.position.set(14, 10);
    this.stats.position.set(14, 26);
    this.title.alpha = 0.58;
    this.stats.alpha = 0.45;

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
    this.vignette.eventMode = "none";

    this.root.sortableChildren = true;
    this.root.addChild(this.title, this.stats, this.hudSpine, this.vignette);
    this.towerView.worldRoot.addChild(this.leftWrap, this.rightWrap, this.pickLayer);
    this.worldRootInteractiveSort();

    this.app.stage.addChild(this.towerView.worldRoot, this.root);

    for (let i = 0; i < MAX_PICK_SLOTS; i++) {
      const wrap = new Container();
      const hit = new Graphics();
      hit.eventMode = "static";
      hit.cursor = "pointer";
      const cap = new Text({
        text: "",
        style: {
          fill: 0xffffff,
          fontSize: 13,
          fontWeight: "700",
          align: "center",
          lineHeight: 16,
          stroke: { color: 0x050812, width: 4 }
        }
      });
      cap.anchor.set(0.5, 1);
      cap.position.set(0, -ISO_TOP_HV - 26);
      wrap.addChild(hit, cap);
      wrap.visible = false;
      this.pickLayer.addChild(wrap);
      this.pickSlots.push({ wrap, hit, cap });
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
    this.pickIsLeft = targets.slice(0, this.activePickCount).map((t) => t.side === "left");

    for (let i = 0; i < this.pickSlots.length; i++) {
      const slot = this.pickSlots[i]!;
      slot.hit.removeAllListeners();
      if (i >= this.activePickCount) {
        slot.wrap.visible = false;
        slot.hit.clear();
        slot.hit.eventMode = "none";
        slot.cap.visible = false;
        continue;
      }

      const t = targets[i]!;
      const tw = tileWorldPos(t.floor, t.side, inp.selfFloor);
      slot.wrap.position.set(tw.x, tw.y);
      slot.wrap.scale.set(tw.scale);
      slot.wrap.visible = true;
      slot.hit.eventMode = "static";
      slot.hit.cursor = "pointer";
      slot.cap.visible = false;

      const pathCopy = [...t.path];
      slot.hit.on("pointerdown", () => {
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
      const hit = this.pickSlots[i]!.hit;
      const neon = this.pickIsLeft[i] ? 0x33bbee : 0xbb55ee;
      const hitW = ISO_TOP_HW * 2 + 36;
      const hitH = ISO_TOP_HV * 2 + ISO_FRONT_DEPTH + 32;
      hit.clear();
      hit.roundRect(-hitW / 2, -ISO_TOP_HV - 14, hitW, hitH, 14).fill({ color: 0x000000, alpha: 0.001 });
      hit.roundRect(-hitW / 2 - 3 - wobble * 1.5, -ISO_TOP_HV - 16 - wobble * 1.5, hitW + 6 + wobble * 3, hitH + 10 + wobble * 3, 14).stroke({
        width: 1.8,
        color: neon,
        alpha: 0.22 + wobble * 0.2
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

    const band = Math.min(width, height) * 0.22;
    this.vignette.clear();
    this.vignette.rect(0, 0, width, band).fill({ color: 0x000000, alpha: 0.55 });
    this.vignette.rect(0, height - band, width, band).fill({ color: 0x000000, alpha: 0.62 });
    this.vignette.rect(0, 0, band, height).fill({ color: 0x000000, alpha: 0.48 });
    this.vignette.rect(width - band, 0, band, height).fill({ color: 0x000000, alpha: 0.48 });
    this.vignette.zIndex = 95;
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
    this.title.text = `${model.floor} / ${CLIENT_GOAL_FLOOR}`;
    this.stats.text = [
      `E ${model.failEnergy.toFixed(0)} · JP ${model.jumpPower} · ${model.runPeakFloor}F peak`,
      `${model.auraTier}${win}${revive}`
    ].join(" · ");
  }

  onPick(cb: (path: Side[]) => void): void {
    this.onPickPathHandler = cb;
  }
}
