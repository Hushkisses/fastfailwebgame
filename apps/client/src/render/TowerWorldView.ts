import { Application, Container, Graphics, Text } from "pixi.js";
import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import type { HintFlash } from "../hint/collectHints";
import type { PickTarget } from "../logic/pickPath";
import { drawFloatingSlab, drawStartingSlab, drawCrackBurst, drawSideGlassShards } from "./drawGlass";
import {
  BRIDGE_MARGIN,
  floorWorldY,
  GLASS_HALF_H,
  ISO_TOP_HW,
  ISO_TOP_HV,
  avatarStackOffset,
  avatarWorldPos,
  columnFog,
  fallTargetStartWorld,
  tileWorldPos,
  TILE_VERTICAL_GAP,
  visibleColumnBand,
  type ScrollSide
} from "./sidescrollLayout";

export type { HintFlash };

export type TowerSide = ScrollSide;

export interface GhostPlayerMini {
  id: string;
  name: string;
  floor: number;
  side: TowerSide;
}

export interface TowerSyncInput {
  screenW: number;
  screenH: number;
  selfId: string;
  selfBestReached: number;
  selfFloor: number;
  selfSide: TowerSide;
  jumpPower: number;
  ghosts: GhostPlayerMini[];
  brokenKeys: string[];
  /** 선택 가능·반짝 슬롯 `층|left|right` (점프력 만큼 여러 열) */
  pickGlowKeys: string[];
  /** 클릭 히트용 (월드뷰는 미사용) */
  pickTargets: PickTarget[];
  hasWon: boolean;
  activeHints: HintFlash[];
}

type FallAnim = {
  fromFloor: number;
  side: TowerSide;
  t0: number;
  durationMs: number;
};

/** 하단→상단 수직 진행, 카메라 수직 추적 */
export class TowerWorldView {
  readonly worldRoot = new Container();
  private readonly pillarG = new Graphics();
  private readonly railG = new Graphics();
  private readonly laneG = new Graphics();
  private readonly paneG = new Graphics();
  private readonly hintGfx = new Graphics();
  private readonly avatarLayer = new Container();
  private readonly hintTexts: Text[] = [];

  private readonly slots: { root: Container; body: Graphics; label: Text }[] = [];

  private readonly falls = new Map<string, FallAnim>();
  private broken = new Set<string>();
  private readonly localBreakStarted = new Map<string, number>();

  private camTX = Number.NaN;
  private camTY = Number.NaN;
  /** 낮은 시선 → 바로 앞 두 발판이 크게 보이는 1인칭 느낌 */
  private readonly camLerp = 0.14;

  constructor(_app: Application) {
    this.worldRoot.sortableChildren = true;
    this.pillarG.zIndex = -2;
    this.railG.zIndex = 0;
    this.laneG.zIndex = 1;
    this.paneG.zIndex = 3;
    this.hintGfx.zIndex = 24;
    this.avatarLayer.sortableChildren = true;
    this.avatarLayer.zIndex = 36;

    for (let i = 0; i < 61; i++) {
      const body = new Graphics();
      const label = new Text({
        text: "",
        style: {
          fill: 0x1a2434,
          fontSize: 10,
          fontWeight: "700",
          stroke: { color: 0xffffff, width: 4 }
        }
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, -16);
      const root = new Container();
      root.eventMode = "none";
      root.addChild(body, label);
      this.slots.push({ root, body, label });
      this.avatarLayer.addChild(root);
    }

    for (let i = 0; i < 18; i++) {
      const t = new Text({
        text: "",
        style: { fill: 0x6a4a10, fontSize: 9, fontWeight: "700", stroke: { color: 0xffffff, width: 4 } }
      });
      t.anchor.set(0.5, 1);
      t.visible = false;
      t.zIndex = 40;
      this.hintTexts.push(t);
      this.worldRoot.addChild(t);
    }

    this.worldRoot.addChild(this.pillarG, this.railG, this.laneG, this.paneG, this.avatarLayer, this.hintGfx);
  }

  handleRemoteFall(id: string, fromFloor: number, side: TowerSide, nowMs: number = performance.now()): void {
    if (!id || fromFloor <= 1) return;
    this.falls.set(id, {
      fromFloor,
      side,
      t0: nowMs,
      durationMs: 760 + Math.min(900, Math.floor(Math.sqrt(fromFloor) * 30))
    });
  }

  triggerLocalGlassBreak(floor: number, side: TowerSide, nowMs: number = performance.now()): void {
    this.localBreakStarted.set(`${floor}|${side}`, nowMs);
  }

  sync(inp: TowerSyncInput, pulse: number): void {
    const now = Date.now();
    const perf = performance.now();
    this.cleanupLocal(perf);
    this.broken = new Set(inp.brokenKeys);

    const { lo, hi } = visibleColumnBand(inp.selfFloor);
    const view = avatarWorldPos(inp.selfFloor, inp.selfSide, inp.selfFloor, inp.jumpPower);

    /**
     * 화면 폭에 따른 월드 스케일 — 모바일 세로 화면에서 양쪽 발판이 모두 보이도록.
     * d=1 두 발판이 여유 있게 들어가는 기준 폭(≈ 940px) 미만이면 비율 축소.
     */
    const FIT_WIDTH = 940;
    const viewScale = Math.min(1, Math.max(0.42, inp.screenW / FIT_WIDTH));
    this.worldRoot.scale.set(viewScale);

    /**
     * 카메라 X — 월드 x=0 고정. 좌·우 선택에 따라 화면이 이동하지 않음.
     * 두 발판은 항상 화면 중앙 기준으로 대칭 배치됨.
     */
    const desiredCamX = inp.screenW * 0.5;
    /** 낮은 시점 — 플레이어가 발판 앞에 서서 위·앞을 올려보는 느낌 */
    const desiredCamY = inp.screenH * 0.91 - viewScale * view.y;

    if (!Number.isFinite(this.camTX)) this.camTX = desiredCamX;
    else this.camTX += (desiredCamX - this.camTX) * this.camLerp;

    if (!Number.isFinite(this.camTY)) this.camTY = desiredCamY;
    else this.camTY += (desiredCamY - this.camTY) * this.camLerp;

    this.worldRoot.position.set(this.camTX, this.camTY);

    const span = this.bridgeSpan(lo, hi, inp.selfFloor, inp.jumpPower);
    this.drawPillars(span, inp.selfFloor, pulse);
    this.railG.clear();
    this.drawVoidBand(span);
    this.drawColumns(inp, lo, hi, pulse, perf);
    this.drawGoal(lo, hi, inp.selfFloor, inp.jumpPower);
    this.drawHintFlares(inp.activeHints, now, inp.selfFloor, inp.jumpPower);
    this.layoutHintTexts(inp.activeHints, now, inp.selfFloor, inp.jumpPower);
    this.layoutCharacters(inp, lo, hi, perf);
  }

  private cleanupLocal(perfNow: number): void {
    for (const [k, t0] of this.localBreakStarted) {
      if (perfNow - t0 > 620) this.localBreakStarted.delete(k);
    }
  }

  private k(row: number, side: ScrollSide): string {
    return `${row}|${side}`;
  }

  private bridgeSpan(
    lo: number,
    hi: number,
    vf: number,
    selectableHops: number
  ): { xlR: number; xrR: number; yTop: number; yBot: number; lo: number; hi: number } {
    let xlR = tileWorldPos(lo, "left", vf, selectableHops).x;
    let xrR = tileWorldPos(lo, "right", vf, selectableHops).x;
    for (let f = lo; f <= hi; f++) {
      xlR = Math.min(xlR, tileWorldPos(f, "left", vf, selectableHops).x);
      xrR = Math.max(xrR, tileWorldPos(f, "right", vf, selectableHops).x);
    }
    const yTop = floorWorldY(hi) - TILE_VERTICAL_GAP * 0.55 - BRIDGE_MARGIN * 0.2;
    const yBot = floorWorldY(lo) + TILE_VERTICAL_GAP * 0.55 + ISO_TOP_HV + GLASS_HALF_H + 80;
    return { xlR, xrR, yTop, yBot, lo, hi };
  }

  private drawPillars(
    span: { xlR: number; xrR: number; yTop: number; yBot: number; lo: number; hi: number },
    vf: number,
    pulse: number
  ): void {
    this.pillarG.clear();
    const { xlR, xrR, yTop, yBot, lo, hi } = span;
    const pillarW = 38;
    const xlP = xlR - pillarW - 30;
    const xrP = xrR + 30;
    const h = yBot - yTop;
    /** 라이트 테마 — 기둥은 어두운 슬레이트 (밝은 배경 위에 또렷) */
    this.pillarG.roundRect(xlP, yTop, pillarW, h, 8).fill({ color: 0x2a3242, alpha: 0.88 });
    this.pillarG.roundRect(xrP, yTop, pillarW, h, 8).fill({ color: 0x2a3242, alpha: 0.88 });

    const glowA = 0.18 + pulse * 0.22;
    let fy = yTop + 56;
    while (fy < yBot - 40) {
      const seed = Math.floor(fy + vf * 13) * 1103515245;
      const j = ((seed >> 8) & 255) % 14;
      this.pillarG.rect(xlP + 10, fy + j * 0.15, 9, 9).fill({ color: 0x1a8fd8, alpha: glowA * 0.5 });
      this.pillarG.rect(xrP + pillarW - 19, fy + j * 0.12, 9, 9).fill({ color: 0xa83cd8, alpha: glowA * 0.45 });
      fy += TILE_VERTICAL_GAP * 0.42;
    }

    const step = Math.max(4, Math.floor((hi - lo) / 16));
    for (let f = lo; f <= hi; f += step) {
      const twL = tileWorldPos(f, "left", vf, 1);
      const y = twL.y;
      this.pillarG.moveTo(xlP + pillarW, y).lineTo(xrP, y).stroke({ width: 0.6, color: 0x99a8c0, alpha: 0.18 });
    }
  }

  private drawRails(span: { xlR: number; xrR: number; yTop: number; yBot: number; lo: number; hi: number }): void {
    this.railG.clear();
    const { xlR, xrR, yTop, yBot, lo, hi } = span;

    /** 라이트 테마 — 레일은 부드러운 회색 라인 */
    this.railG.moveTo(xlR, yTop).lineTo(xlR, yBot).stroke({ width: 2.2, color: 0x6a7a90, alpha: 0.22 });
    this.railG.moveTo(xrR, yTop).lineTo(xrR, yBot).stroke({ width: 2.2, color: 0x7a6a90, alpha: 0.22 });

    const step = Math.max(4, Math.floor((hi - lo) / 14));
    for (let f = lo; f <= hi; f += step) {
      const y = floorWorldY(f);
      this.railG.moveTo(xlR - 10, y).lineTo(xrR + 10, y).stroke({ width: 0.75, color: 0x99a8c0, alpha: 0.18 });
    }
  }

  private drawVoidBand(span: { xlR: number; xrR: number; yTop: number; yBot: number; lo: number }): void {
    this.laneG.clear();
    const { xlR, xrR, yTop, yBot, lo } = span;
    const innerL = xlR + ISO_TOP_HW * 0.42;
    const innerR = xrR - ISO_TOP_HW * 0.42;

    /** 라이트 테마 — 중앙 협곡은 밝은 회색조 그림자 (심연 대신 그림자 갭) */
    const channelTop = yTop - TILE_VERTICAL_GAP * 0.35;
    const channelBot = yBot + TILE_VERTICAL_GAP * 0.5;
    this.laneG
      .rect(innerL, channelTop, innerR - innerL, channelBot - channelTop)
      .fill({ color: 0xb6c0d0, alpha: 0.34 })
      .stroke({ width: 0.8, color: 0x6a7890, alpha: 0.18 });

    /** 협곡 내부 옅은 가로 줄무늬 — 깊이감 살짝 */
    const layers = 9;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const y = channelTop + (channelBot - channelTop) * t;
      const w = (innerR - innerL) * (0.6 + (i % 3) * 0.12);
      const xc = (innerL + innerR) * 0.5;
      this.laneG.ellipse(xc, y, w * 0.5, 18).fill({
        color: 0x8a98ac,
        alpha: 0.14 + (i % 2) * 0.06
      });
    }

    /** 슬래브 발 밑 — 부드러운 그림자 영역 (심연 아니라 바닥 그림자) */
    const abyssTop = floorWorldY(lo) + TILE_VERTICAL_GAP * 0.5;
    const abyssH = TILE_VERTICAL_GAP * 6;
    const fullL = xlR - 240;
    const fullR = xrR + 240;
    this.laneG
      .rect(fullL, abyssTop, fullR - fullL, abyssH)
      .fill({ color: 0xc8d2e0, alpha: 0.42 });
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const y = abyssTop + abyssH * t;
      const h = abyssH * 0.24;
      this.laneG.rect(fullL, y, fullR - fullL, h).fill({
        color: 0xa8b4c8,
        alpha: 0.12 + t * 0.1
      });
    }
  }

  private drawColumns(inp: TowerSyncInput, lo: number, hi: number, pulse: number, perf: number): void {
    this.paneG.clear();
    const glowPick = (kk: string): boolean =>
      !inp.hasWon && inp.pickGlowKeys.includes(kk);
    const vf = inp.selfFloor;

    for (let c = hi; c >= lo; c--) {
      const fog = columnFog(c, inp.selfBestReached, inp.selfFloor);
      /**
       * 시작 층(1층) — 좌/우로 갈라지지 않은 평지 발판 한 개.
       * 시작 위치는 함정/픽 강조 대상이 아니므로 단순 와이드 슬래브로 그린다.
       */
      if (c === 1) {
        const tw = tileWorldPos(c, "left", vf, inp.jumpPower);
        drawStartingSlab(this.paneG, 0, tw.y, { fog, scale: tw.scale });
        continue;
      }
      for (const lane of ["left", "right"] as const) {
        const kk = this.k(c, lane);
        const tw = tileWorldPos(c, lane, vf, inp.jumpPower);
        const loc = { x: tw.x, y: tw.y };
        const broken = this.broken.has(kk);
        const shineBase = glowPick(kk) ? 0.48 + pulse * 0.52 : 0;
        const gw = ISO_TOP_HW * 2.4 * tw.scale;
        const ahead = c - inp.selfFloor;
        const depthFade = Math.min(1, Math.max(0, ahead * 0.065 + fog * 0.35));

        drawFloatingSlab(this.paneG, loc.x, loc.y, {
          fog,
          broken,
          lane,
          glow: shineBase ? shineBase : fog * 0.05,
          scale: tw.scale,
          neonPick: shineBase > 0.05,
          depthFade
        });

        if (broken) {
          drawSideGlassShards(
            this.paneG,
            loc.x,
            loc.y + ISO_TOP_HV * tw.scale * 0.45 + 18 * tw.scale,
            gw,
            c * 19 + (lane === "right" ? 91 : 0)
          );
        }

        const brkLoc = this.localBreakStarted.get(kk);
        if (brkLoc !== undefined) {
          const t = Math.min(1, (perf - brkLoc) / 430);
          drawCrackBurst(this.paneG, loc.x, loc.y, Math.max(0.72, 1 - fog * 0.04) * tw.scale, t);
        }
      }
    }
  }

  private drawGoal(lo: number, hi: number, viewerFloor: number, selectableHops: number): void {
    if (CLIENT_GOAL_FLOOR < lo || CLIENT_GOAL_FLOOR > hi) return;
    const gl = tileWorldPos(CLIENT_GOAL_FLOOR, "left", viewerFloor, selectableHops);
    const gr = tileWorldPos(CLIENT_GOAL_FLOOR, "right", viewerFloor, selectableHops);
    const gy = floorWorldY(CLIENT_GOAL_FLOOR);
    const sc = (gl.scale + gr.scale) * 0.5;
    const span = gr.x - gl.x + ISO_TOP_HW * (gl.scale + gr.scale) + 52 * sc;
    const x0 = gl.x - ISO_TOP_HW * gl.scale - 22 * sc;
    const bannerY = gy - ISO_TOP_HV * sc - 100 * sc;
    this.paneG
      .moveTo(x0, bannerY + 44 * sc)
      .lineTo(x0 + span, bannerY + 44 * sc)
      .lineTo(x0 + span - 18 * sc, bannerY)
      .lineTo(x0 + 18 * sc, bannerY)
      .closePath()
      .fill({ color: 0x886622, alpha: 0.22 });
    const mid = (gl.x + gr.x) * 0.5;
    this.paneG
      .moveTo(mid, bannerY + 42 * sc)
      .lineTo(mid, gy - ISO_TOP_HV * sc - 12 * sc)
      .stroke({ width: 1.2, color: 0xffcc66, alpha: 0.18 });
  }

  private drawHintFlares(
    rows: HintFlash[],
    serverNow: number,
    viewerFloor: number,
    selectableHops: number
  ): void {
    this.hintGfx.clear();
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      const pulse = Math.min(1.2, Math.max(0, (h.expiresAt - serverNow) / 1000));
      const p = tileWorldPos(h.floor, h.safeSide, viewerFloor, selectableHops);
      const bw = (ISO_TOP_HW * 2 + 52) * p.scale;
      const bh = (ISO_TOP_HV * 2 + 88) * p.scale;
      this.hintGfx
        .roundRect(p.x - bw / 2, p.y - bh / 2 + 8 * p.scale, bw, bh, 16 * p.scale)
        .stroke({ width: 1.8 + pulse * 0.5, color: 0xaa9944, alpha: 0.14 + pulse * 0.18 });
    }
  }

  private layoutHintTexts(
    rows: HintFlash[],
    serverNow: number,
    viewerFloor: number,
    selectableHops: number
  ): void {
    let i = 0;
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      if (i >= this.hintTexts.length) break;
      const lbl = this.hintTexts[i++];
      const p = tileWorldPos(h.floor, h.safeSide, viewerFloor, selectableHops);
      const nn = h.nickname.length > 14 ? `${h.nickname.slice(0, 13)}…` : h.nickname;
      lbl.text = nn;
      lbl.position.set(p.x, p.y - ISO_TOP_HV * p.scale - 96 * p.scale);
      lbl.visible = true;
    }
    for (; i < this.hintTexts.length; i++) this.hintTexts[i].visible = false;
  }

  private layoutCharacters(inp: TowerSyncInput, lo: number, hi: number, perf: number): void {
    const nowTs = Date.now();
    let si = 0;
    const start = fallTargetStartWorld();
    const isFallingAlive = (id: string): boolean => {
      const anim = this.falls.get(id);
      if (!anim) return false;
      return (perf - anim.t0) / anim.durationMs < 1 - 1e-7;
    };

    for (const g of inp.ghosts) {
      if (!isFallingAlive(g.id)) continue;
      if (si >= this.slots.length) break;
      const anim = this.falls.get(g.id)!;
      const tRaw = Math.min(1, (perf - anim.t0) / anim.durationMs);
      const ease = tRaw * tRaw;
      const b0 = tileWorldPos(anim.fromFloor, anim.side, inp.selfFloor, inp.jumpPower);
      const x = b0.x + (start.x - b0.x) * ease;
      const y = b0.y + (start.y - b0.y) * ease;
      const slot = this.slots[si++];
      slot.root.visible = true;
      slot.root.scale.set(1);
      slot.root.position.set(x, y);
      slot.root.zIndex = 500000;
      slot.body.clear().ellipse(0, 6, 12, 8).fill({ color: 0xff5566, alpha: 0.42 });
      slot.label.text = "";
      slot.label.visible = false;
      slot.label.position.set(0, -52);
      if (tRaw >= 1 - 1e-6) this.falls.delete(g.id);
    }

    const buckets = new Map<string, GhostPlayerMini[]>();
    for (const g of inp.ghosts) {
      if (isFallingAlive(g.id)) continue;
      const key = `${g.floor}|${g.side}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(g);
    }

    const keysSorted = [...buckets.keys()].sort((a, b) => Number(a.split("|")[0]) - Number(b.split("|")[0]));

    for (const key of keysSorted) {
      const arr = buckets.get(key)!;
      arr.sort((a, b) => a.id.localeCompare(b.id));
      const [frStr, ln] = key.split("|");
      const row = Number(frStr);
      const side = ln as ScrollSide;
      if (row < lo - 22 || row > hi + 22) continue;

      const twBase = tileWorldPos(row, side, inp.selfFloor, inp.jumpPower);
      const n = arr.length;
      /** 시작 층(1층) — 좌/우 분리 발판이 아니라 평지 한 개이므로 아바타도 가운데(x=0) */
      const baseX = row === 1 ? 0 : twBase.x;

      arr.forEach((pl, ix) => {
        if (si >= this.slots.length) return;
        const slot = this.slots[si++];
        const stack = avatarStackOffset(ix, n, twBase.scale);

        slot.root.visible = true;
        slot.root.scale.set(twBase.scale);
        slot.root.position.set(baseX + stack.dx, twBase.y - stack.dy);
        slot.root.zIndex = -row * 800 + ix;

        slot.body.position.set(0, 0);
        const self = pl.id === inp.selfId;
        const many = n > 18;
        const rO = self ? (many ? 8 : 10) : many ? 5 : 7;
        const rI = self ? (many ? 6 : 8) : many ? 4 : 6;
        slot.body.clear().circle(0, 0, rO).stroke({
          width: self ? 2.5 : 1.2,
          color: self ? 0x1a8fd8 : 0x4a5a78,
          alpha: self ? 0.95 : 0.55
        });
        slot.body.circle(0, 0, rI).fill({
          color: self ? 0x1a8fd8 : 0x607890,
          alpha: self ? 0.75 : 0.55
        });

        slot.label.anchor.set(0.5, 1);
        slot.label.visible = self;
        if (!self) {
          slot.label.text = "";
        } else {
          const nmCap = 12;
          const raw = pl.name.length > nmCap ? `${pl.name.slice(0, nmCap - 1)}…` : pl.name;
          slot.label.text = `YOU · ${raw}`;
          slot.label.style.fontSize = 11;
          slot.label.style.fontWeight = "800";
          slot.label.style.fill = 0x1a8fd8;
          slot.label.style.stroke = { color: 0xffffff, width: 4 };
          slot.label.style.align = "center";
          slot.label.style.lineHeight = 13;
          slot.label.position.set(0, -12);
        }
      });
    }

    while (si < this.slots.length) {
      this.slots[si++].root.visible = false;
    }
  }
}
