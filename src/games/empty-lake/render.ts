import {
  H,
  HORIZON,
  ROD_TIP,
  SHORE_Y,
  W,
  type Sim,
} from "./engine";

const SUN_X = W * 0.34;
const SUN_Y = HORIZON - 30;

/** 매 프레임 흔들리지 않게 파문·나무 배치는 미리 고정해 둔다 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const RIPPLES = (() => {
  const rnd = seeded(20260819);
  const rows = 30;
  return Array.from({ length: rows }, (_, i) => {
    const u = i / (rows - 1);
    const y = HORIZON + Math.pow(u, 1.9) * (H - HORIZON);
    return {
      y,
      u,
      dashes: Array.from({ length: 5 + Math.floor(u * 5) }, () => ({
        x: rnd() * W,
        len: 10 + rnd() * 46,
        speed: 0.25 + rnd() * 0.7,
        phase: rnd() * Math.PI * 2,
      })),
    };
  });
})();

const TREES = (() => {
  const rnd = seeded(773);
  return Array.from({ length: 46 }, () => ({
    x: rnd() * W,
    h: 6 + rnd() * 16,
    w: 3 + rnd() * 5,
  }));
})();

function sky(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#121d33");
  g.addColorStop(0.45, "#33486a");
  g.addColorStop(0.82, "#8f7f8c");
  g.addColorStop(1, "#d59a72");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON);

  // 해
  const glow = ctx.createRadialGradient(SUN_X, SUN_Y, 2, SUN_X, SUN_Y, 62);
  glow.addColorStop(0, "rgba(255, 214, 160, 0.95)");
  glow.addColorStop(0.35, "rgba(244, 179, 120, 0.35)");
  glow.addColorStop(1, "rgba(244, 179, 120, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(SUN_X - 70, SUN_Y - 70, 140, 140);
  ctx.fillStyle = "#ffe0b0";
  ctx.beginPath();
  ctx.arc(SUN_X, SUN_Y, 13, 0, Math.PI * 2);
  ctx.fill();

  // 건너편 산
  ctx.fillStyle = "#233247";
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  ctx.lineTo(0, HORIZON - 22);
  ctx.lineTo(46, HORIZON - 38);
  ctx.lineTo(108, HORIZON - 20);
  ctx.lineTo(170, HORIZON - 34);
  ctx.lineTo(246, HORIZON - 16);
  ctx.lineTo(310, HORIZON - 30);
  ctx.lineTo(W, HORIZON - 18);
  ctx.lineTo(W, HORIZON);
  ctx.closePath();
  ctx.fill();

  // 건너편 나무
  ctx.fillStyle = "#101a29";
  ctx.fillRect(0, HORIZON - 7, W, 7);
  for (const t of TREES) {
    ctx.beginPath();
    ctx.moveTo(t.x - t.w / 2, HORIZON - 5);
    ctx.lineTo(t.x, HORIZON - 5 - t.h);
    ctx.lineTo(t.x + t.w / 2, HORIZON - 5);
    ctx.closePath();
    ctx.fill();
  }

  // 물안개
  const mist = ctx.createLinearGradient(0, HORIZON - 26, 0, HORIZON + 6);
  mist.addColorStop(0, "rgba(214, 205, 200, 0)");
  mist.addColorStop(1, "rgba(214, 205, 200, 0.32)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, HORIZON - 26, W, 32);
}

function water(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, H);
  g.addColorStop(0, "#9c8a86");
  g.addColorStop(0.12, "#42566f");
  g.addColorStop(0.55, "#22344b");
  g.addColorStop(1, "#141e2c");
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // 해의 반영
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 34; i++) {
    const u = i / 33;
    const y = HORIZON + Math.pow(u, 1.7) * (H - HORIZON) * 0.72;
    const wob = Math.sin(t * 1.6 + i * 0.9) * (4 + u * 26);
    const wide = 10 + u * 40;
    ctx.fillStyle = `rgba(247, 191, 133, ${0.2 * (1 - u)})`;
    ctx.fillRect(SUN_X - wide / 2 + wob, y, wide, 1.6 + u * 2);
  }
  ctx.restore();

  // 잔물결
  ctx.lineCap = "round";
  for (const row of RIPPLES) {
    ctx.lineWidth = 0.8 + row.u * 1.6;
    ctx.strokeStyle = `rgba(226, 236, 245, ${0.05 + row.u * 0.1})`;
    for (const d of row.dashes) {
      const x = (d.x + Math.sin(t * d.speed + d.phase) * (6 + row.u * 22)) % W;
      const len = d.len * (0.35 + row.u);
      ctx.beginPath();
      ctx.moveTo(x, row.y);
      ctx.lineTo(x + len, row.y);
      ctx.stroke();
    }
  }
}

/** 착수·회수 파문 */
function rings(ctx: CanvasRenderingContext2D, sim: Sim) {
  if (sim.splash <= 0) return;
  const p = 1 - sim.splash;
  ctx.strokeStyle = `rgba(233, 242, 250, ${sim.splash * 0.55})`;
  for (let i = 0; i < 3; i++) {
    const r = (10 + i * 9 + p * 34) * sim.scale;
    ctx.lineWidth = 1.4 * sim.scale;
    ctx.beginPath();
    ctx.ellipse(sim.fx, sim.fy, r, r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function wake(ctx: CanvasRenderingContext2D, sim: Sim) {
  if (sim.wake <= 0) return;
  ctx.strokeStyle = `rgba(226, 238, 248, ${sim.wake * 0.4})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sim.fx, sim.fy);
  ctx.lineTo(sim.fx + 26 * sim.wake, sim.fy + 7 * sim.wake);
  ctx.moveTo(sim.fx, sim.fy);
  ctx.lineTo(sim.fx + 26 * sim.wake, sim.fy - 7 * sim.wake);
  ctx.stroke();
}

/** 막대찌. dip만큼 수면 아래로 잠긴다 */
function bobber(ctx: CanvasRenderingContext2D, sim: Sim) {
  if (sim.phase === "ready") return;
  const s = sim.scale;
  const len = 46 * s;
  const above = len * (1 - sim.dip);
  const x = sim.fx;
  const waterY = sim.fy;

  // 수면 아래로 잠긴 부분은 흐리게
  if (sim.dip > 0 && sim.phase !== "cast") {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 3.4 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, waterY);
    ctx.lineTo(x, waterY + len * sim.dip * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  const top = waterY - above;
  // 몸통
  ctx.lineCap = "round";
  ctx.lineWidth = 3.4 * s;
  ctx.strokeStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(x, waterY);
  ctx.lineTo(x, top + above * 0.42);
  ctx.stroke();

  // 톱. 빨강·흰색 마디
  const tipLen = above * 0.42;
  const seg = tipLen / 3;
  ctx.lineWidth = 2.6 * s;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i % 2 === 0 ? "#ef4444" : "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(x, top + seg * i);
    ctx.lineTo(x, top + seg * (i + 1));
    ctx.stroke();
  }
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(x, top, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // 수면과 만나는 자리
  if (sim.phase === "wait") {
    ctx.strokeStyle = "rgba(233, 242, 250, 0.5)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.ellipse(x, waterY, 7 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** 낚싯대와 원줄 */
function rod(ctx: CanvasRenderingContext2D, sim: Sim) {
  const lift = sim.jerk * 34;
  const tipX = ROD_TIP.x;
  const tipY = ROD_TIP.y - lift;

  // 원줄. 팽팽하지 않으면 늘어진다
  if (sim.phase !== "ready") {
    const sag = sim.phase === "strike" || sim.phase === "reel" ? 4 : 16;
    ctx.strokeStyle = "rgba(233, 242, 250, 0.42)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      (tipX + sim.fx) / 2,
      (tipY + sim.fy) / 2 + sag,
      sim.fx,
      sim.fy - 46 * sim.scale * (1 - sim.dip),
    );
    ctx.stroke();
  }

  // 대. 손잡이는 화면 밖 오른쪽 아래에서 들어온다
  ctx.lineCap = "round";
  const buttX = W + 14;
  const buttY = H + 18;
  for (const [wdt, color] of [
    [5.5, "#0b1220"],
    [2.4, "#334155"],
  ] as const) {
    ctx.lineWidth = wdt;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(buttX, buttY);
    ctx.quadraticCurveTo(tipX + 34, tipY + 62 - lift * 0.5, tipX, tipY);
    ctx.stroke();
  }
  // 가이드
  ctx.fillStyle = "#94a3b8";
  for (const u of [0.35, 0.62, 0.85]) {
    const gx = (1 - u) * (1 - u) * buttX + 2 * (1 - u) * u * (tipX + 34) + u * u * tipX;
    const gy =
      (1 - u) * (1 - u) * buttY + 2 * (1 - u) * u * (tipY + 62 - lift * 0.5) + u * u * tipY;
    ctx.beginPath();
    ctx.arc(gx, gy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
  ctx.fill();
}

/** 발밑 갈대. 원근을 만든다 */
function reeds(ctx: CanvasRenderingContext2D, t: number) {
  ctx.strokeStyle = "#0b1220";
  ctx.lineCap = "round";
  const stalks = [
    [8, 74],
    [22, 96],
    [34, 62],
    [50, 84],
    [W - 96, 58],
    [W - 78, 88],
  ];
  stalks.forEach(([x, h], i) => {
    const sway = Math.sin(t * 0.9 + i) * 5;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, SHORE_Y + 22);
    ctx.quadraticCurveTo(x + sway * 0.4, SHORE_Y + 22 - h * 0.6, x + sway, SHORE_Y + 22 - h);
    ctx.stroke();
  });
}

export function draw(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.clearRect(0, 0, W, H);
  sky(ctx);
  water(ctx, sim.t);
  rings(ctx, sim);
  wake(ctx, sim);
  bobber(ctx, sim);
  rod(ctx, sim);
  reeds(ctx, sim.t);
}
