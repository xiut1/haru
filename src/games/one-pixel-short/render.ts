import {
  BIRD_H,
  BIRD_W,
  BIRD_X,
  GAP,
  GROUND_H,
  GROUND_Y,
  H,
  PIPE_CAP_H,
  PIPE_W,
  W,
  type Pipe,
  type Sim,
} from "./engine";

/** 구름·건물 배치가 매 프레임 흔들리지 않게 고정해 둔다 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CLOUDS = (() => {
  const rnd = seeded(20260825);
  return Array.from({ length: 7 }, () => ({
    x: rnd() * 720,
    y: 34 + rnd() * 130,
    s: 0.6 + rnd() * 0.9,
    speed: 0.14 + rnd() * 0.16,
  }));
})();

const CITY = (() => {
  const rnd = seeded(4471);
  let x = -30;
  const out: { x: number; w: number; h: number; win: number }[] = [];
  while (x < 760) {
    const w = 22 + rnd() * 34;
    out.push({ x, w, h: 26 + rnd() * 54, win: rnd() });
    x += w + 4 + rnd() * 10;
  }
  return out;
})();

const BUSHES = (() => {
  const rnd = seeded(919);
  return Array.from({ length: 26 }, (_, i) => ({
    x: i * 30 + rnd() * 12,
    r: 12 + rnd() * 10,
  }));
})();

function sky(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, "#3aa7bd");
  g.addColorStop(0.55, "#4ec0ca");
  g.addColorStop(1, "#9ddfdf");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND_Y);
}

function clouds(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (const c of CLOUDS) {
    const x = ((c.x - t * c.speed) % 480 + 480) % 480 - 60;
    const r = 16 * c.s;
    ctx.beginPath();
    ctx.arc(x, c.y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, c.y - r * 0.4, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x + r * 1.8, c.y, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, c.y + r * 0.3, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function city(ctx: CanvasRenderingContext2D, t: number) {
  const base = GROUND_Y + 4;
  const off = ((t * 0.3) % 380 + 380) % 380;
  ctx.fillStyle = "#5ec6b0";
  for (const b of CITY) {
    const x = b.x - off;
    if (x > W + 40 || x < -60) continue;
    ctx.fillRect(x, base - b.h, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let wy = base - b.h + 8; wy < base - 8; wy += 10) {
      for (let wx = x + 5; wx < x + b.w - 6; wx += 9) {
        if (((wx + wy + b.win * 100) | 0) % 3 === 0) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    ctx.fillStyle = "#5ec6b0";
  }

  const off2 = ((t * 0.7) % 780 + 780) % 780;
  ctx.fillStyle = "#7ed35a";
  for (const b of BUSHES) {
    const x = b.x - off2;
    for (const px of [x, x + 780]) {
      if (px > W + 30 || px < -30) continue;
      ctx.beginPath();
      ctx.arc(px, base + 2, b.r, Math.PI, 0);
      ctx.fill();
    }
  }
}

function pipe(ctx: CanvasRenderingContext2D, p: Pipe) {
  const x = Math.round(p.x);
  const gapTop = p.gapTop;

  const body = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  body.addColorStop(0, "#4e9822");
  body.addColorStop(0.16, "#8ed14f");
  body.addColorStop(0.45, "#74bf2e");
  body.addColorStop(0.86, "#4e9822");
  body.addColorStop(1, "#3d7a1a");

  // 관은 캡보다 눈에 띄게 좁다. 원본과 같은 실루엣
  const TUBE_INSET = 7;
  const drawTube = (y: number, h: number) => {
    if (h <= 0) return;
    ctx.fillStyle = body;
    ctx.fillRect(x + TUBE_INSET, y, PIPE_W - TUBE_INSET * 2, h);
    ctx.strokeStyle = "#33620f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + TUBE_INSET + 1, y - 1, PIPE_W - TUBE_INSET * 2 - 2, h + 2);
  };
  const drawCap = (y: number) => {
    ctx.fillStyle = body;
    ctx.fillRect(x, y, PIPE_W, PIPE_CAP_H);
    ctx.strokeStyle = "#33620f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PIPE_W - 2, PIPE_CAP_H - 2);
    // 캡 윗면 하이라이트
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + 3, y + 3, PIPE_W - 6, 3);
  };

  // 위쪽 파이프
  drawTube(-4, gapTop - PIPE_CAP_H + 4);
  drawCap(gapTop - PIPE_CAP_H);
  // 아래쪽 파이프
  drawCap(gapTop + GAP);
  drawTube(gapTop + GAP + PIPE_CAP_H, GROUND_Y - (gapTop + GAP + PIPE_CAP_H));
}

function ground(ctx: CanvasRenderingContext2D, off: number) {
  ctx.fillStyle = "#ded895";
  ctx.fillRect(0, GROUND_Y, W, GROUND_H);

  ctx.fillStyle = "#74bf2e";
  ctx.fillRect(0, GROUND_Y, W, 12);
  ctx.fillStyle = "#5c9c22";
  ctx.fillRect(0, GROUND_Y + 12, W, 3);

  // 잔디 톱니
  ctx.fillStyle = "#8ed14f";
  for (let x = -24 + (24 - off); x < W + 24; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 12);
    ctx.lineTo(x + 6, GROUND_Y + 4);
    ctx.lineTo(x + 12, GROUND_Y + 12);
    ctx.fill();
  }

  // 흙 빗금
  ctx.strokeStyle = "#cdc47e";
  ctx.lineWidth = 5;
  for (let x = -24 - off; x < W + 40; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 20);
    ctx.lineTo(x + 12, GROUND_Y + 40);
    ctx.stroke();
  }
}

function bird(ctx: CanvasRenderingContext2D, sim: Sim) {
  const cx = BIRD_X + BIRD_W / 2;
  const cy = sim.by + BIRD_H / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sim.rot);

  ctx.strokeStyle = "#4a3a10";
  ctx.lineWidth = 2;

  // 꼬리 (히트박스 밖)
  ctx.fillStyle = "#e8b52f";
  ctx.beginPath();
  ctx.moveTo(-BIRD_W / 2 + 2, -3);
  ctx.lineTo(-BIRD_W / 2 - 7, -7);
  ctx.lineTo(-BIRD_W / 2 - 6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 몸통 (= 히트박스)
  ctx.fillStyle = "#f8d049";
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 배
  ctx.fillStyle = "#fdf3c8";
  ctx.beginPath();
  ctx.ellipse(1, 5, BIRD_W / 2 - 6, BIRD_H / 2 - 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 날개
  const flap = Math.sin(sim.wing);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-3, 1 + flap * 3, 8, 5.5 - flap * 2, flap * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 눈
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(6, -5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#20180a";
  ctx.beginPath();
  ctx.arc(7.6, -5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // 부리 (히트박스 밖)
  ctx.fillStyle = "#f07c22";
  ctx.beginPath();
  ctx.moveTo(BIRD_W / 2 - 3, -1);
  ctx.lineTo(BIRD_W / 2 + 9, 1);
  ctx.lineTo(BIRD_W / 2 - 3, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/** 몸통 26px와 간격 25px를 화면에서 직접 재 보여준다 */
function hitboxes(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.save();
  ctx.lineWidth = 1;

  // 파이프 간격
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,60,60,0.16)";
  for (const p of sim.pipes) {
    if (p.x > W + 10 || p.x + PIPE_W < -10) continue;
    ctx.fillRect(p.x, p.gapTop, PIPE_W, GAP);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.gapTop + 0.5);
    ctx.lineTo(p.x + PIPE_W + 6, p.gapTop + 0.5);
    ctx.moveTo(p.x - 6, p.gapTop + GAP - 0.5);
    ctx.lineTo(p.x + PIPE_W + 6, p.gapTop + GAP - 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 새 몸통
  ctx.strokeStyle = "#ff2d2d";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(BIRD_X + 0.5, sim.by + 0.5, BIRD_W - 1, BIRD_H - 1);

  // 가장 가까운 앞쪽 파이프에 치수선
  const next = sim.pipes.find((p) => p.x + PIPE_W > BIRD_X);
  if (next && next.x < W - 40) {
    const mx = next.x + PIPE_W / 2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, next.gapTop);
    ctx.lineTo(mx, next.gapTop + GAP);
    ctx.stroke();

    ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(`${GAP}px`, mx, next.gapTop - 6);
    ctx.fillText(`${GAP}px`, mx, next.gapTop - 6);
  }

  ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.fillStyle = "#ff8080";
  ctx.strokeText(`${BIRD_H}px`, BIRD_X - 4, sim.by + BIRD_H / 2 + 4);
  ctx.fillText(`${BIRD_H}px`, BIRD_X - 4, sim.by + BIRD_H / 2 + 4);

  ctx.restore();
}

function score(ctx: CanvasRenderingContext2D, sim: Sim) {
  if (sim.phase === "ready") return;
  ctx.save();
  ctx.font = "bold 44px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(40,40,40,0.85)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(String(sim.score), W / 2, 72);
  ctx.fillText(String(sim.score), W / 2, 72);
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, sim: Sim, showHitbox: boolean) {
  ctx.save();
  if (sim.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * sim.shake * 0.6,
      (Math.random() - 0.5) * sim.shake * 0.6,
    );
  }

  sky(ctx);
  clouds(ctx, sim.t);
  city(ctx, sim.t);

  for (const p of sim.pipes) {
    if (p.x > W + 10 || p.x + PIPE_W < -10) continue;
    pipe(ctx, p);
  }

  ground(ctx, sim.ground);
  bird(ctx, sim);
  if (showHitbox) hitboxes(ctx, sim);
  score(ctx, sim);

  ctx.restore();

  if (sim.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${sim.flash * 0.16})`;
    ctx.fillRect(0, 0, W, H);
  }
}
