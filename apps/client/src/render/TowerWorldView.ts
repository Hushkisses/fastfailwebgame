import { Application, Container, Graphics, Text } from "pixi.js";
import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import type { HintFlash } from "../hint/collectHints";
import type { PickTarget } from "../logic/pickPath";
import { drawBridgeVerticalBlock, drawCrackBurst, drawSideGlassShards } from "./drawGlass";
import {
  BRIDGE_MARGIN,
  floorWorldY,
  GLASS_HALF_H,
  ISO_TOP_HW,
  ISO_TOP_HV,
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
  private readonly camLerp = 0.18;

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
          fill: 0xffffff,
          fontSize: 14,
          fontWeight: "700",
          stroke: { color: 0x0a1020, width: 3 }
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
        style: { fill: 0xfff1b0, fontSize: 10, stroke: { color: 0x000000, width: 5 } }
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
    const view = avatarWorldPos(inp.selfFloor, inp.selfSide, inp.selfFloor);

    const desiredCamX = inp.screenW * 0.5 - view.x;
    const desiredCamY = inp.screenH * 0.7 - view.y;

    if (!Number.isFinite(this.camTX)) this.camTX = desiredCamX;
    else this.camTX += (desiredCamX - this.camTX) * this.camLerp;

    if (!Number.isFinite(this.camTY)) this.camTY = desiredCamY;
    else this.camTY += (desiredCamY - this.camTY) * this.camLerp;

    this.worldRoot.position.set(this.camTX, this.camTY);

    const span = this.bridgeSpan(lo, hi, inp.selfFloor);
    this.drawPillars(span, inp.selfFloor, pulse);
    this.drawRails(span);
    this.drawVoidBand(span);
    this.drawColumns(inp, lo, hi, pulse, perf);
    this.drawGoal(lo, hi, inp.selfFloor);
    this.drawHintFlares(inp.activeHints, now, inp.selfFloor);
    this.layoutHintTexts(inp.activeHints, now, inp.selfFloor);
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
    vf: number
  ): { xlR: number; xrR: number; yTop: number; yBot: number; lo: number; hi: number } {
    let xlR = tileWorldPos(lo, "left", vf).x;
    let xrR = tileWorldPos(lo, "right", vf).x;
    for (let f = lo; f <= hi; f++) {
      xlR = Math.min(xlR, tileWorldPos(f, "left", vf).x);
      xrR = Math.max(xrR, tileWorldPos(f, "right", vf).x);
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
    this.pillarG.roundRect(xlP, yTop, pillarW, h, 8).fill({ color: 0x06090f, alpha: 0.78 });
    this.pillarG.roundRect(xrP, yTop, pillarW, h, 8).fill({ color: 0x06090f, alpha: 0.78 });

    const glowA = 0.28 + pulse * 0.42;
    let fy = yTop + 56;
    while (fy < yBot - 40) {
      const seed = Math.floor(fy + vf * 13) * 1103515245;
      const j = ((seed >> 8) & 255) % 14;
      this.pillarG.rect(xlP + 10, fy + j * 0.15, 11, 11).fill({ color: 0x3399ff, alpha: glowA * 0.65 });
      this.pillarG.rect(xrP + pillarW - 21, fy + j * 0.12, 11, 11).fill({ color: 0xaa66ee, alpha: glowA * 0.55 });
      fy += TILE_VERTICAL_GAP * 0.42;
    }

    const step = Math.max(4, Math.floor((hi - lo) / 16));
    for (let f = lo; f <= hi; f += step) {
      const twL = tileWorldPos(f, "left", vf);
      const y = twL.y;
      this.pillarG.moveTo(xlP + pillarW, y).lineTo(xrP, y).stroke({ width: 0.85, color: 0xffffff, alpha: 0.04 });
    }
  }

  private drawRails(span: { xlR: number; xrR: number; yTop: number; yBot: number; lo: number; hi: number }): void {
    this.railG.clear();
    const { xlR, xrR, yTop, yBot, lo, hi } = span;

    this.railG.moveTo(xlR, yTop).lineTo(xlR, yBot).stroke({ width: 3.4, color: 0xb8d4ff, alpha: 0.32 });
    this.railG.moveTo(xrR, yTop).lineTo(xrR, yBot).stroke({ width: 3.4, color: 0xd4b8e8, alpha: 0.28 });

    const step = Math.max(4, Math.floor((hi - lo) / 14));
    for (let f = lo; f <= hi; f += step) {
      const y = floorWorldY(f);
      this.railG.moveTo(xlR - 10, y).lineTo(xrR + 10, y).stroke({ width: 1.05, color: 0xffffff, alpha: 0.07 });
    }
  }

  private drawVoidBand(span: { xlR: number; xrR: number; yTop: number; yBot: number }): void {
    this.laneG.clear();
    const { xlR, xrR, yTop, yBot } = span;
    const innerL = xlR + ISO_TOP_HW * 0.42;
    const innerR = xrR - ISO_TOP_HW * 0.42;
    this.laneG
      .rect(innerL, yTop - TILE_VERTICAL_GAP * 0.35, innerR - innerL, yBot - yTop + TILE_VERTICAL_GAP * 0.7)
      .fill({ color: 0x020408, alpha: 0.62 })
      .stroke({ width: 1, color: 0x223344, alpha: 0.08 });
  }

  /** 위쪽(+전진) 방향 표시 */
  private drawForwardCue(g: Graphics, cx: number, cy: number, alpha: number, scale: number): void {
    const hv = ISO_TOP_HV * scale;
    const tipY = cy - hv - 52 * scale;
    const baseY = cy - hv - 14 * scale;
    g.moveTo(cx - 28 * scale, baseY)
      .lineTo(cx, tipY)
      .lineTo(cx + 28 * scale, baseY)
      .closePath()
      .stroke({ width: 2.4, color: 0xfffde6, alpha });
    g.moveTo(cx - 28 * scale, baseY)
      .lineTo(cx, tipY)
      .lineTo(cx + 28 * scale, baseY)
      .closePath()
      .fill({ color: 0xffffff, alpha: alpha * 0.14 });
  }

  private drawColumns(inp: TowerSyncInput, lo: number, hi: number, pulse: number, perf: number): void {
    this.paneG.clear();
    const glowPick = (kk: string): boolean =>
      !inp.hasWon && inp.pickGlowKeys.includes(kk);
    const vf = inp.selfFloor;

    for (let c = hi; c >= lo; c--) {
      const fog = columnFog(c, inp.selfBestReached, inp.selfFloor);
      for (const lane of ["left", "right"] as const) {
        const kk = this.k(c, lane);
        const tw = tileWorldPos(c, lane, vf);
        const loc = { x: tw.x, y: tw.y };
        const broken = this.broken.has(kk);
        const shineBase = glowPick(kk) ? 0.48 + pulse * 0.52 : 0;
        const gw = ISO_TOP_HW * 2.4 * tw.scale;

        drawBridgeVerticalBlock(this.paneG, loc.x, loc.y, {
          fog,
          broken,
          lane,
          glow: shineBase ? shineBase : fog * 0.06,
          scale: tw.scale,
          neonPick: shineBase > 0.05
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

        if (shineBase && !broken) {
          const a = shineBase * 0.78;
          this.drawForwardCue(this.paneG, loc.x, loc.y, Math.min(0.95, a), tw.scale);
        }

        const brkLoc = this.localBreakStarted.get(kk);
        if (brkLoc !== undefined) {
          const t = Math.min(1, (perf - brkLoc) / 430);
          drawCrackBurst(this.paneG, loc.x, loc.y, Math.max(0.72, 1 - fog * 0.04) * tw.scale, t);
        }
      }
    }
  }

  private drawGoal(lo: number, hi: number, viewerFloor: number): void {
    if (CLIENT_GOAL_FLOOR < lo || CLIENT_GOAL_FLOOR > hi) return;
    const gl = tileWorldPos(CLIENT_GOAL_FLOOR, "left", viewerFloor);
    const gr = tileWorldPos(CLIENT_GOAL_FLOOR, "right", viewerFloor);
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
      .fill({ color: 0xffde66, alpha: 0.88 });
    const mid = (gl.x + gr.x) * 0.5;
    this.paneG
      .moveTo(mid, bannerY + 42 * sc)
      .lineTo(mid, gy - ISO_TOP_HV * sc - 12 * sc)
      .stroke({ width: 1.8, color: 0xffffff, alpha: 0.38 });
  }

  private drawHintFlares(rows: HintFlash[], serverNow: number, viewerFloor: number): void {
    this.hintGfx.clear();
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      const pulse = Math.min(1.2, Math.max(0, (h.expiresAt - serverNow) / 1000));
      const p = tileWorldPos(h.floor, h.safeSide, viewerFloor);
      const bw = (ISO_TOP_HW * 2 + 52) * p.scale;
      const bh = (ISO_TOP_HV * 2 + 88) * p.scale;
      this.hintGfx
        .roundRect(p.x - bw / 2, p.y - bh / 2 + 8 * p.scale, bw, bh, 16 * p.scale)
        .stroke({ width: 3.5 + pulse, color: 0xfff8b0, alpha: 0.28 + pulse * 0.5 });
    }
  }

  private layoutHintTexts(rows: HintFlash[], serverNow: number, viewerFloor: number): void {
    let i = 0;
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      if (i >= this.hintTexts.length) break;
      const lbl = this.hintTexts[i++];
      const p = tileWorldPos(h.floor, h.safeSide, viewerFloor);
      const nn = h.nickname.length > 14 ? `${h.nickname.slice(0, 13)}…` : h.nickname;
      lbl.text = `${nn} · ⚡안전패널 노출중`;
      lbl.position.set(p.x, p.y - ISO_TOP_HV * p.scale - 118 * p.scale);
      lbl.visible = true;
    }
    for (; i < this.hintTexts.length; i++) this.hintTexts[i].visible = false;
  }

  private layoutCharacters(inp: TowerSyncInput, lo: number, hi: number, perf: number): void {
    const nowTs = Date.now();
    let si = 0;
    const start = fallTargetStartWorld();
    const hintedUsers = new Set(inp.activeHints.filter((h) => nowTs < h.expiresAt).map((h) => h.playerId));

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
      const b0 = tileWorldPos(anim.fromFloor, anim.side, inp.selfFloor);
      const x = b0.x + (start.x - b0.x) * ease;
      const y = b0.y + (start.y - b0.y) * ease;
      const slot = this.slots[si++];
      slot.root.visible = true;
      slot.root.scale.set(1);
      slot.root.position.set(x, y);
      slot.root.zIndex = 500000;
      slot.body.clear().ellipse(0, 6, 12, 8).fill({ color: 0xff7788, alpha: 0.55 });
      slot.label.text = `${g.name.length > 14 ? `${g.name.slice(0, 13)}…` : g.name}\n· 추락`;
      slot.label.style.fontSize = 14;
      slot.label.style.fontWeight = "700";
      slot.label.style.fill = 0xfff0f8;
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
    const nickLine = 17;
    const bodyLiftPerStack = 6;

    for (const key of keysSorted) {
      const arr = buckets.get(key)!;
      arr.sort((a, b) => a.id.localeCompare(b.id));
      const [frStr, ln] = key.split("|");
      const row = Number(frStr);
      const side = ln as ScrollSide;
      if (row < lo - 22 || row > hi + 22) continue;

      const twBase = tileWorldPos(row, side, inp.selfFloor);
      const n = arr.length;

      arr.forEach((pl, ix) => {
        if (si >= this.slots.length) return;
        const slot = this.slots[si++];
        const lift = ix * bodyLiftPerStack;

        slot.root.visible = true;
        slot.root.scale.set(twBase.scale);
        slot.root.position.set(twBase.x, twBase.y - lift);
        slot.root.zIndex = -row * 800 + ix;

        slot.body.position.set(0, 0);
        const self = pl.id === inp.selfId;
        const many = n > 18;
        const rO = self ? (many ? 9 : 11) : many ? 6 : 8;
        const rI = self ? (many ? 7 : 9) : many ? 4.5 : 6.5;
        slot.body.clear().circle(0, 0, rO).stroke({
          width: self ? 3 : 1.5,
          color: self ? 0xfff188 : 0x9aceff,
          alpha: self ? 0.95 : 0.62
        });
        slot.body.circle(0, 0, rI).fill({
          color: self ? 0xfff4dc : 0x93cfff,
          alpha: self ? 0.92 : 0.54
        });

        slot.label.anchor.set(0.5, 1);
        const nmCap = 22;
        const raw = pl.name.length > nmCap ? `${pl.name.slice(0, nmCap - 1)}…` : pl.name;
        slot.label.text = self ? `YOU\n▼\n${raw} ⭐` : raw;
        slot.label.style.fontSize = 14;
        slot.label.style.fontWeight = "700";
        const hinted = hintedUsers.has(pl.id);
        slot.label.style.fill = self ? 0xfffce8 : hinted ? 0xfff2b8 : 0xffffff;
        slot.label.style.stroke = { color: 0x0a1020, width: 3 };
        slot.label.style.align = "center";
        slot.label.style.lineHeight = self ? 14 : 18;
        slot.label.position.set(0, -14 - ix * nickLine);
      });
    }

    while (si < this.slots.length) {
      this.slots[si++].root.visible = false;
    }
  }
}
