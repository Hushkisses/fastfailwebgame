import { Application, Container, Graphics, Text } from "pixi.js";
import { CLIENT_GOAL_FLOOR } from "../config/climbConfig";
import type { HintFlash } from "../hint/collectHints";
import type { PickTarget } from "../logic/pickPath";
import { drawCrackBurst, drawSideGlassShards, drawSideGlassSlab } from "./drawGlass";
import {
  BRIDGE_MARGIN,
  GLASS_HALF_H,
  GLASS_HALF_W,
  LANE_LOWER_Y,
  LANE_UPPER_Y,
  avatarWorldPos,
  choiceColumnWorldX,
  columnFog,
  fallTargetStartWorld,
  mutedLaneColor,
  tileWorldCenter,
  TILE_GAP,
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

/** 완전 2D 직교 좌표 횡스크롤 — 상단/하단 수평, 중앙 y=0. */
export class TowerWorldView {
  readonly worldRoot = new Container();
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

  private camLX = Number.NaN;
  private readonly camLerp = 0.2;

  constructor(_app: Application) {
    this.worldRoot.sortableChildren = true;
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
        style: { fill: 0xfff7ff, fontSize: 10, fontWeight: "600", stroke: { color: 0x080c14, width: 4 } }
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, -52);
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

    this.worldRoot.addChild(this.railG, this.laneG, this.paneG, this.avatarLayer, this.hintGfx);
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
    const view = avatarWorldPos(inp.selfFloor, inp.selfSide);
    const desiredCamX = inp.screenW * (1 / 3) - view.x;
    if (!Number.isFinite(this.camLX)) this.camLX = desiredCamX;
    else this.camLX += (desiredCamX - this.camLX) * this.camLerp;

    this.worldRoot.position.set(this.camLX, inp.screenH * 0.5);

    this.drawRails(lo, hi);
    this.drawVoidBand(lo, hi);
    this.drawColumns(inp, lo, hi, pulse, perf);
    this.drawGoal(lo, hi);
    this.drawHintFlares(inp.activeHints, now);
    this.layoutHintTexts(inp.activeHints, now);
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

  private drawRails(lo: number, hi: number): void {
    this.railG.clear();
    const x0 = tileWorldCenter(lo, "left").x - TILE_GAP / 2 - BRIDGE_MARGIN;
    const x1 = tileWorldCenter(hi, "left").x + TILE_GAP / 2 + BRIDGE_MARGIN;
    const yU = LANE_UPPER_Y + GLASS_HALF_H + 64;
    const yL = LANE_LOWER_Y - GLASS_HALF_H - 62;
    this.railG.moveTo(x0, yU).lineTo(x1, yU).stroke({ width: 3.4, color: 0xb8d4ff, alpha: 0.22 });
    this.railG.moveTo(x0, yL).lineTo(x1, yL).stroke({ width: 3.4, color: 0xd4b8e8, alpha: 0.2 });
    for (let c = lo; c <= hi; c += Math.max(5, Math.floor((hi - lo) / 12))) {
      const x = choiceColumnWorldX(c);
      this.railG.moveTo(x, yU + 14).lineTo(x, yL - 14).stroke({ width: 1.1, color: 0xffffff, alpha: 0.05 });
    }
  }

  private drawVoidBand(lo: number, hi: number): void {
    this.laneG.clear();
    const xL = tileWorldCenter(lo, "left").x - TILE_GAP / 2 - BRIDGE_MARGIN;
    const span = tileWorldCenter(hi, "left").x - tileWorldCenter(lo, "left").x + TILE_GAP + BRIDGE_MARGIN * 2;
    const topPad = GLASS_HALF_H + 104;
    this.laneG
      .rect(xL - 30, LANE_UPPER_Y + topPad, span + 60, LANE_LOWER_Y - LANE_UPPER_Y - topPad * 2)
      .fill({ color: 0x03060c, alpha: 0.4 })
      .stroke({ width: 1, color: 0xffffff, alpha: 0.04 });
  }

  /** 다음 열(+X 전진) 방향 표시 — 상·하 레인 공통 */
  private drawForwardCue(g: Graphics, cx: number, cy: number, alpha: number): void {
    const ex = cx + GLASS_HALF_W + 42;
    g.moveTo(ex - 34, cy - 24)
      .lineTo(ex + 36, cy)
      .lineTo(ex - 34, cy + 24)
      .closePath()
      .stroke({ width: 2.4, color: 0xfffde6, alpha });
    g.moveTo(ex - 34, cy - 24)
      .lineTo(ex + 36, cy)
      .lineTo(ex - 34, cy + 24)
      .closePath()
      .fill({ color: 0xffffff, alpha: alpha * 0.16 });
  }

  private drawColumns(inp: TowerSyncInput, lo: number, hi: number, pulse: number, perf: number): void {
    this.paneG.clear();
    const gw = GLASS_HALF_W * 2.14;
    const gh = GLASS_HALF_H * 2.06;
    const glowPick = (kk: string): boolean =>
      !inp.hasWon && inp.pickGlowKeys.includes(kk);

    for (let c = hi; c >= lo; c--) {
      const fog = columnFog(c, inp.selfBestReached, inp.selfFloor);
      for (const lane of ["left", "right"] as const) {
        const kk = this.k(c, lane);
        const loc = tileWorldCenter(c, lane);
        const broken = this.broken.has(kk);
        const tint = mutedLaneColor(lane, fog);
        const shineBase = glowPick(kk) ? 0.48 + pulse * 0.52 : 0;

        if (broken) {
          drawSideGlassSlab(this.paneG, loc.x, loc.y, gw * 0.74, gh * 0.8, 0x223449, { glow: 0 });
          drawSideGlassShards(this.paneG, loc.x, loc.y + 6, gw, c * 19 + (lane === "right" ? 91 : 0));
        } else {
          drawSideGlassSlab(this.paneG, loc.x, loc.y, gw, gh, tint, {
            glow: shineBase ? shineBase : fog * 0.05
          });
        }

        if (shineBase && !broken) {
          const a = shineBase * 0.78;
          this.drawForwardCue(this.paneG, loc.x, loc.y, Math.min(0.95, a));
        }

        const brkLoc = this.localBreakStarted.get(kk);
        if (brkLoc !== undefined) {
          const t = Math.min(1, (perf - brkLoc) / 430);
          drawCrackBurst(this.paneG, loc.x, loc.y, Math.max(0.72, 1 - fog * 0.04), t);
        }
      }
    }
  }

  private drawGoal(lo: number, hi: number): void {
    if (CLIENT_GOAL_FLOOR < lo || CLIENT_GOAL_FLOOR > hi) return;
    const ux = choiceColumnWorldX(CLIENT_GOAL_FLOOR);
    const yP = Math.min(LANE_UPPER_Y - 154, -210);
    this.paneG
      .moveTo(ux + 48, yP + 38)
      .lineTo(ux - 42, yP - 8)
      .lineTo(ux + 148, yP + 22)
      .closePath()
      .fill({ color: 0xffde66, alpha: 0.82 });
    this.paneG.moveTo(ux + 48, yP + 34).lineTo(ux + 52, LANE_UPPER_Y + 110).stroke({ width: 1.6, color: 0xffffff, alpha: 0.35 });
  }

  private drawHintFlares(rows: HintFlash[], serverNow: number): void {
    this.hintGfx.clear();
    const bw = GLASS_HALF_W * 2 + 52;
    const bh = GLASS_HALF_H * 2 + 44;
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      const pulse = Math.min(1.2, Math.max(0, (h.expiresAt - serverNow) / 1000));
      const p = tileWorldCenter(h.floor, h.safeSide);
      this.hintGfx
        .roundRect(p.x - bw / 2, p.y - bh / 2 + 12, bw, bh, 16)
        .stroke({ width: 3.5 + pulse, color: 0xfff8b0, alpha: 0.28 + pulse * 0.5 });
    }
  }

  private layoutHintTexts(rows: HintFlash[], serverNow: number): void {
    let i = 0;
    for (const h of rows) {
      if (serverNow >= h.expiresAt) continue;
      if (i >= this.hintTexts.length) break;
      const lbl = this.hintTexts[i++];
      const p = tileWorldCenter(h.floor, h.safeSide);
      const nn = h.nickname.length > 14 ? `${h.nickname.slice(0, 13)}…` : h.nickname;
      lbl.text = `${nn} · ⚡안전패널 노출중`;
      lbl.position.set(p.x, p.y - GLASS_HALF_H - 124);
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
      const b0 = tileWorldCenter(anim.fromFloor, anim.side);
      const x = b0.x + (start.x - b0.x) * ease;
      const y = b0.y + (start.y - b0.y) * ease;
      const slot = this.slots[si++];
      slot.root.visible = true;
      slot.root.position.set(x, y);
      slot.root.zIndex = 5000;
      slot.body.clear().ellipse(0, 6, 12, 8).fill({ color: 0xff7788, alpha: 0.55 });
      slot.label.text = `${g.name.length > 11 ? `${g.name.slice(0, 11)}…` : g.name}\n· 추락`;
      slot.label.style.fill = 0xffd5ef;
      slot.label.position.set(0, -42);
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

      const avBase = avatarWorldPos(row, side);
      const n = Math.max(arr.length, 1);
      const perRow = n <= 10 ? n : Math.min(10, Math.ceil(Math.sqrt(n * 1.15)));
      const spacing = Math.max(16, Math.min(24, (TILE_GAP + 40) / (perRow + 1)));
      const rowStep = n > 14 ? 22 : 18;

      arr.forEach((pl, ix) => {
        if (si >= this.slots.length) return;
        const slot = this.slots[si++];
        const gridRow = Math.floor(ix / perRow);
        const colIx = ix % perRow;
        const rowStart = gridRow * perRow;
        const nThisRow = Math.min(perRow, n - rowStart);
        const ox = (colIx - (nThisRow - 1) / 2) * spacing;
        const oy = -gridRow * rowStep;

        slot.root.visible = true;
        slot.root.position.set(avBase.x + ox, avBase.y + oy);
        slot.root.zIndex = row * 100 + gridRow * 10 + colIx;

        slot.body.position.set(0, 0);
        const self = pl.id === inp.selfId;
        const many = n > 20;
        const rO = self ? (many ? 10 : 12) : many ? 5.5 : 8;
        const rI = self ? (many ? 8 : 10) : many ? 4.5 : 7;
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
        const nmCap = self ? 16 : many ? 9 : 12;
        const nm =
          pl.name.length > nmCap ? `${pl.name.slice(0, nmCap - 1)}…` : pl.name;
        slot.label.text = nm + (self ? " ⭐" : "");
        slot.label.style.fill = self ? 0xfffaee : hintedUsers.has(pl.id) ? 0xfff2b8 : 0xf4fcff;
        slot.label.style.fontSize = many ? 9 : 10;
        slot.label.position.set(0, -22 - gridRow * 2);
      });
    }

    while (si < this.slots.length) {
      this.slots[si++].root.visible = false;
    }
  }
}
