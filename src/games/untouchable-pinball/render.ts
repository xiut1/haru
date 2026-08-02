import { flipperTip, type Game, H, W } from "./engine";

const TABLE = "#0b1120";
const WALL = "#475569";
const NEON = "#38bdf8";

function capsule(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
) {
  ctx.lineCap = "round";
  ctx.lineWidth = r * 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

export function draw(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.clearRect(0, 0, W, H);

  // 테이블
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#111a2e");
  bg.addColorStop(1, TABLE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 발사 레인 음영
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(318, 90, 28, 514);

  // 벽
  for (const w of g.walls) {
    const hot = w.flash > 0.05;
    ctx.strokeStyle = hot
      ? `rgba(250, 204, 21, ${0.35 + w.flash * 0.65})`
      : w.score
        ? "#7c3aed"
        : WALL;
    capsule(ctx, w.a.x, w.a.y, w.b.x, w.b.y, w.score ? 4 : 3);
  }

  // 역류 방지 게이트
  if (g.gateClosed) {
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(318, 150);
    ctx.lineTo(346, 112);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 범퍼
  for (const bm of g.bumpers) {
    const f = bm.flash;
    ctx.beginPath();
    ctx.arc(bm.p.x, bm.p.y, bm.r, 0, Math.PI * 2);
    ctx.fillStyle = f > 0.05 ? "#fef08a" : bm.r > 10 ? "#be185d" : "#334155";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = f > 0.05 ? "#fff" : bm.r > 10 ? "#f472b6" : "#64748b";
    ctx.stroke();
    if (bm.r > 10) {
      ctx.beginPath();
      ctx.arc(bm.p.x, bm.p.y, bm.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = f > 0.05 ? "#fff" : "#fb7185";
      ctx.fill();
    }
  }

  // 플리퍼
  for (const fl of g.flippers) {
    const tip = flipperTip(fl);
    if (fl.blocked) {
      ctx.strokeStyle = "rgba(239,68,68,0.28)";
      capsule(ctx, fl.pivot.x, fl.pivot.y, tip.x, tip.y, 11);
    }
    ctx.strokeStyle = fl.blocked ? "#ef4444" : fl.pressed ? "#7dd3fc" : NEON;
    capsule(ctx, fl.pivot.x, fl.pivot.y, tip.x, tip.y, 6);
    ctx.beginPath();
    ctx.arc(fl.pivot.x, fl.pivot.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
  }

  // 플런저 게이지
  if (g.phase === "ready") {
    const h = 46 * g.charge;
    ctx.fillStyle = "rgba(56,189,248,0.25)";
    ctx.fillRect(324, 552, 16, 46);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(324, 552 + (46 - h), 16, h);
    ctx.strokeStyle = "rgba(148,163,184,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(324, 552, 16, 46);
  }

  // 공
  const b = g.ball;
  const grd = ctx.createRadialGradient(
    b.p.x - 2.5,
    b.p.y - 3,
    1,
    b.p.x,
    b.p.y,
    b.r,
  );
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(1, "#94a3b8");
  ctx.beginPath();
  ctx.arc(b.p.x, b.p.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // 드레인 표시
  ctx.strokeStyle = "rgba(239,68,68,0.25)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(96, 582);
  ctx.lineTo(246, 582);
  ctx.stroke();
  ctx.setLineDash([]);
}
