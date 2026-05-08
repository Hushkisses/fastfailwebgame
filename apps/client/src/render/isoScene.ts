import { Application, Container, Graphics, Point, Text } from "pixi.js";
import { LEAP_STEPS } from "../gameConstants";

export interface PlayerView {
  id: string;
  floor: number;
  currentSide: string;
  failCount: number;
  auraTier: string;
}

/** floor = node id in binary heap; side kept for compat, X is drawn by node id. */
export interface TrailView {
  floor: number;
  side: string;
}

type Side = "left" | "right";

function childNode(parentId: number, side: Side): number {
  return side === "left" ? parentId * 2 : parentId * 2 + 1;
}

function jumpLandingNode(fromId: number, side: Side, steps: number): number {
  const n = Math.max(1, steps);
  let cur = fromId;
  for (let i = 0; i < n; i += 1) {
    cur = childNode(cur, side);
  }
  return cur;
}

const TREE_DX = 46;
const TREE_DY = -28;
const TILE_HW = 28;
const TILE_HH = 14;

function treeLayoutPos(id: number): { x: number; y: number } {
  if (id < 1) id = 1;
  if (id === 1) return { x: 0, y: 0 };
  const pid = Math.floor(id / 2);
  const p = treeLayoutPos(pid);
  const left = id % 2 === 0;
  return {
    x: p.x + (left ? -TREE_DX : TREE_DX),
    y: p.y + TREE_DY
  };
}

function diamondHit(lx: number, ly: number, cx: number, cy: number, hw: number, hh: number, pad = 1.15): boolean {
  const dx = lx - cx;
  const dy = ly - cy;
  return Math.abs(dx) / hw + Math.abs(dy) / hh <= pad;
}

export class IsoScene {
  private root = new Container();
  private readonly world = new Container();
  private readonly camLayer = new Container();
  private readonly tileLayer = new Container();
  private readonly playerLayer = new Container();
  private readonly trailLayer = new Container();
  private readonly statusLabel = new Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 14 }
  });

  private readonly camCur = { x: 0, y: 0 };
  private readonly camTarget = { x: 0, y: 0 };
  private leftTargetId = jumpLandingNode(1, "left", LEAP_STEPS);
  private rightTargetId = jumpLandingNode(1, "right", LEAP_STEPS);

  constructor(private readonly app: Application) {
    this.camLayer.addChild(this.tileLayer, this.trailLayer, this.playerLayer);
    this.world.addChild(this.camLayer);
    this.root.addChild(this.world);
    this.statusLabel.position.set(-380, -320);
    this.root.addChild(this.statusLabel);
    this.app.stage.addChild(this.root);
  }

  resize(width: number, height: number): void {
    this.root.position.set(width * 0.5, height * 0.52);
    this.world.scale.set(1.08, 0.68);
    this.world.skew.set(0, -0.08);
  }

  /** Smoothly keep the current node near the center (world/cam offset). */
  updateCameraFocus(currentNodeId: number, deltaMS: number): void {
    const p = treeLayoutPos(Math.max(1, currentNodeId));
    this.camTarget.x = -p.x;
    this.camTarget.y = -p.y;
    const t = Math.min(1, (deltaMS / 1000) * 6);
    this.camCur.x += (this.camTarget.x - this.camCur.x) * t;
    this.camCur.y += (this.camTarget.y - this.camCur.y) * t;
    this.camLayer.position.set(this.camCur.x, this.camCur.y);
  }

  drawTiles(currentNodeId: number): void {
    this.tileLayer.removeChildren();

    const node = Math.max(1, currentNodeId);
    const leftTarget = jumpLandingNode(node, "left", LEAP_STEPS);
    const rightTarget = jumpLandingNode(node, "right", LEAP_STEPS);
    this.leftTargetId = leftTarget;
    this.rightTargetId = rightTarget;

    const time = this.app.ticker.lastTime * 0.01;
    const dl = nodeDepthPure(leftTarget);
    const dr = nodeDepthPure(rightTarget);
    const dc = nodeDepthPure(node);
    const displayDepth = Math.min(14, Math.max(dl, dr, dc) + 3);
    const nodes = collectTreeNodes(displayDepth);
    const selectable = new Set<number>([leftTarget, rightTarget]);

    nodes.forEach((id) => {
      const pos = treeLayoutPos(id);
      const isSel = selectable.has(id);
      const pulse = isSel ? (Math.sin(time + (id === leftTarget ? 0 : 2.7)) + 1) * 0.5 : 0;

      const baseTint = id === node ? 0x5f7ab8 : isSel ? 0x7ea6ff : 0x4a5678;
      this.tileLayer.addChild(this.makeDiamond(pos.x, pos.y, TILE_HW, TILE_HH, baseTint));

      if (isSel) {
        this.tileLayer.addChild(this.makeGlowDiamond(pos.x, pos.y, TILE_HW, TILE_HH, pulse));
        this.tileLayer.addChild(this.makeSpark(pos.x, pos.y, pulse, id));
        this.tileLayer.addChild(this.makeSpark(pos.x, pos.y, pulse * 0.7, id + 997));
      }
    });
  }

  drawPlayers(players: PlayerView[]): void {
    this.playerLayer.removeChildren();
    players.forEach((player, idx) => {
      const tint = player.auraTier === "gold" ? 0xffd74f : player.auraTier === "purple" ? 0x8f64ff : 0x4aa3ff;
      const tilePos = treeLayoutPos(Math.max(1, player.floor | 0));
      const g = new Graphics().circle(0, 0, 9).fill(0xffffff).stroke({ color: tint, width: 3 });
      g.position.set(tilePos.x, tilePos.y - 8 - (idx % 3) * 4);
      this.playerLayer.addChild(g);
    });
  }

  drawTrails(trails: TrailView[]): void {
    this.trailLayer.removeChildren();
    trails.slice(-80).forEach((trail) => {
      const pos = treeLayoutPos(Math.max(1, trail.floor | 0));
      const xMark = new Graphics();
      xMark.moveTo(-6, -6).lineTo(6, 6).moveTo(6, -6).lineTo(-6, 6).stroke({ color: 0xff3e3e, width: 2 });
      xMark.position.set(pos.x, pos.y - 2);
      this.trailLayer.addChild(xMark);
    });
  }

  /**
   * Which leap target was tapped in canvas pixel space. Returns null if miss.
   */
  pickLeapTarget(clientX: number, clientY: number): Side | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const scaleX = this.app.renderer.width / Math.max(1, rect.width);
    const scaleY = this.app.renderer.height / Math.max(1, rect.height);
    const gx = (clientX - rect.left) * scaleX;
    const gy = (clientY - rect.top) * scaleY;
    const global = new Point(gx, gy);
    const local = new Point();
    this.camLayer.toLocal(global, undefined, local);

    const lPos = treeLayoutPos(this.leftTargetId);
    const rPos = treeLayoutPos(this.rightTargetId);
    const hitL = diamondHit(local.x, local.y, lPos.x, lPos.y, TILE_HW, TILE_HH);
    const hitR = diamondHit(local.x, local.y, rPos.x, rPos.y, TILE_HW, TILE_HH);
    if (hitL && hitR) {
      const dl = Math.hypot(local.x - lPos.x, local.y - lPos.y);
      const dr = Math.hypot(local.x - rPos.x, local.y - rPos.y);
      return dl <= dr ? "left" : "right";
    }
    if (hitL) return "left";
    if (hitR) return "right";
    return null;
  }

  setStatus(text: string): void {
    this.statusLabel.text = text;
  }

  private makeDiamond(x: number, y: number, hw: number, hh: number, color: number): Graphics {
    const g = new Graphics();
    g.moveTo(0, -hh)
      .lineTo(hw, 0)
      .lineTo(0, hh)
      .lineTo(-hw, 0)
      .closePath()
      .fill(color)
      .stroke({ color: 0x20273a, width: 1 });
    g.position.set(x, y);
    return g;
  }

  private makeGlowDiamond(x: number, y: number, hw: number, hh: number, pulse: number): Graphics {
    const g = new Graphics();
    const width = 2 + pulse * 2;
    g.moveTo(0, -hh - 1)
      .lineTo(hw + 1, 0)
      .lineTo(0, hh + 1)
      .lineTo(-hw - 1, 0)
      .closePath()
      .stroke({ color: 0xbfd3ff, width, alpha: 0.55 + pulse * 0.45 });
    g.position.set(x, y);
    return g;
  }

  private makeSpark(x: number, y: number, pulse: number, seed: number): Graphics {
    const angle = this.app.ticker.lastTime * 0.003 + seed;
    const sx = Math.cos(angle) * 14;
    const sy = Math.sin(angle) * 6;
    const g = new Graphics();
    g.circle(0, 0, 1.5 + pulse * 1.5).fill({ color: 0xe9f4ff, alpha: 0.6 + pulse * 0.4 });
    g.position.set(x + sx, y - 8 + sy);
    return g;
  }
}

function collectTreeNodes(maxDepth: number): number[] {
  const out: number[] = [];
  const q = [1];
  while (q.length) {
    const n = q.shift()!;
    const d = nodeDepthPure(n);
    if (d > maxDepth) continue;
    out.push(n);
    if (d < maxDepth) {
      q.push(2 * n, 2 * n + 1);
    }
  }
  return out.sort((a, b) => a - b);
}

function nodeDepthPure(n: number): number {
  if (n < 1) return 0;
  return Math.floor(Math.log2(n));
}
