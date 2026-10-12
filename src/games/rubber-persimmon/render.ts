import { along, BRANCHES, FRUIT_R, FRUITS, ground, H, W, type Sim } from "./engine";

/** 잎 덩어리. 가지 끝 기준 오프셋이라 가지와 같이 흔들린다. */
const LEAVES: { branch: number; t: number; dx: number; dy: number; r: number; c: string }[] = [
  { branch: 3, t: 1, dx: -6, dy: -8, r: 26, c: "#3f7d3a" },
  { branch: 3, t: 0.5, dx: -4, dy: -14, r: 22, c: "#4f8f3f" },
  { branch: 8, t: 1, dx: -4, dy: -6, r: 20, c: "#5b9a44" },
  { branch: 2, t: 0.7, dx: 4, dy: -18, r: 24, c: "#4a8a3d" },
  { branch: 5, t: 1, dx: 6, dy: -8, r: 26, c: "#3f7d3a" },
  { branch: 5, t: 0.5, dx: 4, dy: -14, r: 22, c: "#4f8f3f" },
  { branch: 4, t: 0.7, dx: -4, dy: -18, r: 24, c: "#4a8a3d" },
  { branch: 6, t: 1, dx: -4, dy: -10, r: 26, c: "#468a3c" },
  { branch: 7, t: 1, dx: 4, dy: -10, r: 26, c: "#3f7d3a" },
  { branch: 1, t: 1, dx: 0, dy: -20, r: 28, c: "#55963f" },
  { branch: 1, t: 0.5, dx: 0, dy: -6, r: 24, c: "#4a8a3d" },
  { branch: 7, t: 0.6, dx: 10, dy: -4, r: 14, c: "#6aa64a" },
  { branch: 6, t: 0.5, dx: -12, dy: -2, r: 12, c: "#6aa64a" },
];

function persimmon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, r = FRUIT_R) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#f07a1a";
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.3, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4b6b2a";
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(0, -r * 0.82);
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(r * 0.28, 0, r * 0.3, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * @param ink 바닥·글자에 쓸 전경색. 다크모드를 따라간다.
 * @param bud 빈 나무일 때 꽃눈 진행도 0~1. 열매가 달려 있으면 null.
 */
export function draw(ctx: CanvasRenderingContext2D, sim: Sim, ink: string, bud: number | null) {
  ctx.clearRect(0, 0, W, H);

  // 언덕
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, ground(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, ground(x));
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 가지
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6b4528";
  sim.segs.forEach((s, i) => {
    ctx.lineWidth = BRANCHES[i].width;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  });

  // 잎
  for (const l of LEAVES) {
    const a = along(sim.segs[l.branch], l.t);
    ctx.fillStyle = l.c;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(a.x + l.dx, a.y + l.dy, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 꽃눈. 열매 자리에 진행도만큼 자란다.
  if (bud !== null) {
    for (const f of FRUITS) {
      const a = along(sim.segs[f.branch], f.t);
      const r = 1.5 + bud * (FRUIT_R - 1.5);
      if (bud < 0.6) {
        ctx.fillStyle = "#9cc95a";
        ctx.beginPath();
        ctx.arc(a.x, a.y + 3 + r * 0.6, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        persimmon(ctx, a.x, a.y + 3 + r, 0, r);
      }
    }
  }

  // 감
  sim.fruits.forEach((f, id) => {
    if (f.state === "gone") return;
    if (f.state === "hang") {
      const a = along(sim.segs[FRUITS[id].branch], FRUITS[id].t);
      const dx = f.p.x - a.x;
      const dy = f.p.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const top = d - FRUIT_R * 0.8;
      ctx.strokeStyle = "#4b3a22";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (dx / d) * top, a.y + (dy / d) * top);
      ctx.stroke();
      // 꼭지 방향으로 기울여 매단다.
      persimmon(ctx, f.p.x, f.p.y, -Math.atan2(dx, dy));
      return;
    }
    persimmon(ctx, f.p.x, f.p.y, f.spin);
  });
}
