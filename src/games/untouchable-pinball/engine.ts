/**
 * 아주 정직한 핀볼 물리 엔진.
 * 중력, 반발, 범퍼 킥, 플리퍼 각속도 전달까지 전부 제대로 구현되어 있다.
 * 단 하나, 공이 플리퍼 근처에 오면 「안전장치」가 작동해 플리퍼가 내려간다.
 */

export const W = 360;
export const H = 620;

const SUB = 5; // 서브스텝 (터널링 방지)
const GRAVITY = 0.11; // px / frame^2
const MAX_SPEED = 20;
const DRAIN_Y = 582;
const BALL_R = 7.5;

/** 공이 이 반경 안에 들어오면 플리퍼는 강제로 내려간다. 플리퍼 길이는 60이다. */
const SAFETY_RADIUS = 118;

const FLIPPER_LEN = 60;
const FLIPPER_R = 5.5;
const FLIPPER_SPEED = 0.42; // rad / frame

const PLUNGER = { x: 332, y: 592 };

export type Vec = { x: number; y: number };
export type Phase = "ready" | "play" | "over";

export type Wall = {
  a: Vec;
  b: Vec;
  /** 반발계수 */
  e: number;
  score: number;
  /** 법선 방향 추가 가속 */
  kick: number;
  /** 히트 시 잔광 */
  flash: number;
};

export type Bumper = {
  p: Vec;
  r: number;
  e: number;
  score: number;
  kick: number;
  flash: number;
};

export type Flipper = {
  side: "left" | "right";
  pivot: Vec;
  restAngle: number;
  upAngle: number;
  angle: number;
  angVel: number;
  pressed: boolean;
  /** 안전장치가 작동 중인가 (누르고 있는데 공이 가까워서 내려간 상태) */
  blocked: boolean;
};

export type Ball = { p: Vec; v: Vec; r: number };

export type Game = {
  phase: Phase;
  score: number;
  ballsLeft: number;
  /** 플리퍼를 휘두른 횟수 */
  swings: number;
  /** 그중 공을 실제로 쳐올린 횟수 */
  hits: number;
  /** 안전장치가 작동한 횟수 */
  saves: number;
  charge: number;
  ball: Ball;
  flippers: Flipper[];
  bumpers: Bumper[];
  walls: Wall[];
  gateClosed: boolean;
  idle: number;
  elapsed: number;
  prevSpace: boolean;
};

export type Input = { left: boolean; right: boolean; space: boolean };

const rad = (deg: number) => (deg * Math.PI) / 180;

function wall(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  opts: Partial<Pick<Wall, "e" | "score" | "kick">> = {},
): Wall {
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    e: opts.e ?? 0.58,
    score: opts.score ?? 0,
    kick: opts.kick ?? 0,
    flash: 0,
  };
}

function buildWalls(): Wall[] {
  return [
    // 바깥 테두리
    wall(14, 24, 300, 24),
    wall(300, 24, 346, 90), // 우상단 디플렉터: 발사된 공을 좌측 필드로 꺾어준다
    wall(346, 90, 346, 604),
    wall(14, 24, 14, 430),
    wall(318, 604, 346, 604), // 플런저 바닥
    // 발사 레인 격벽
    wall(318, 150, 318, 604),
    // 인레인 경사 — 공을 플리퍼로 안내한다. 아주 친절하다.
    wall(14, 430, 80, 505),
    wall(80, 505, 88, 560),
    wall(318, 430, 260, 505),
    wall(260, 505, 252, 560),
    // 슬링샷
    wall(68, 425, 105, 480, { e: 0.95, score: 50, kick: 5 }),
    wall(264, 425, 227, 480, { e: 0.95, score: 50, kick: 5 }),
  ];
}

/** 발사 후 닫히는 역류 방지 게이트. gateClosed일 때만 살아난다. */
const GATE: Wall = wall(318, 150, 346, 112, { e: 0.4 });

function buildBumpers(): Bumper[] {
  const big = (x: number, y: number, r: number): Bumper => ({
    p: { x, y },
    r,
    e: 0.9,
    score: 100,
    kick: 6,
    flash: 0,
  });
  const post = (x: number, y: number): Bumper => ({
    p: { x, y },
    r: 6,
    e: 0.8,
    score: 10,
    kick: 1.5,
    flash: 0,
  });
  return [
    big(105, 195, 21),
    big(215, 175, 21),
    big(160, 268, 19),
    post(60, 320),
    post(260, 330),
    post(166, 108),
  ];
}

function buildFlippers(): Flipper[] {
  return [
    {
      side: "left",
      pivot: { x: 98, y: 518 },
      restAngle: rad(30),
      upAngle: rad(-32),
      angle: rad(30),
      angVel: 0,
      pressed: false,
      blocked: false,
    },
    {
      side: "right",
      pivot: { x: 242, y: 518 },
      restAngle: rad(150),
      upAngle: rad(212),
      angle: rad(150),
      angVel: 0,
      pressed: false,
      blocked: false,
    },
  ];
}

export function createGame(): Game {
  return {
    phase: "ready",
    score: 0,
    ballsLeft: 3,
    swings: 0,
    hits: 0,
    saves: 0,
    charge: 0,
    ball: { p: { ...PLUNGER }, v: { x: 0, y: 0 }, r: BALL_R },
    flippers: buildFlippers(),
    bumpers: buildBumpers(),
    walls: buildWalls(),
    gateClosed: false,
    idle: 0,
    elapsed: 0,
    prevSpace: false,
  };
}

export function flipperTip(f: Flipper): Vec {
  return {
    x: f.pivot.x + Math.cos(f.angle) * FLIPPER_LEN,
    y: f.pivot.y + Math.sin(f.angle) * FLIPPER_LEN,
  };
}

function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return { ...a };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/**
 * 공 ↔ 선분(반지름 segR의 캡슐) 충돌.
 * surface는 접점의 표면 속도 (플리퍼 회전 전달용).
 * 충돌했으면 법선을, 아니면 null을 돌려준다.
 */
function collideSegment(
  ball: Ball,
  a: Vec,
  b: Vec,
  segR: number,
  e: number,
  kick: number,
  surface?: (c: Vec) => Vec,
): Vec | null {
  const c = closestOnSegment(ball.p, a, b);
  let dx = ball.p.x - c.x;
  let dy = ball.p.y - c.y;
  let d = Math.hypot(dx, dy);
  const minD = ball.r + segR;
  if (d >= minD) return null;
  if (d < 1e-6) {
    dx = 0;
    dy = -1;
    d = 1;
  }
  const n = { x: dx / d, y: dy / d };
  ball.p.x = c.x + n.x * minD;
  ball.p.y = c.y + n.y * minD;

  const s = surface ? surface(c) : { x: 0, y: 0 };
  const rvx = ball.v.x - s.x;
  const rvy = ball.v.y - s.y;
  const vn = rvx * n.x + rvy * n.y;
  if (vn < 0) {
    const j = -(1 + e) * vn + kick;
    ball.v.x += j * n.x;
    ball.v.y += j * n.y;
  }
  return n;
}

function collideCircle(ball: Ball, bm: Bumper): boolean {
  let dx = ball.p.x - bm.p.x;
  let dy = ball.p.y - bm.p.y;
  let d = Math.hypot(dx, dy);
  const minD = ball.r + bm.r;
  if (d >= minD) return false;
  if (d < 1e-6) {
    dx = 0;
    dy = -1;
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  ball.p.x = bm.p.x + nx * minD;
  ball.p.y = bm.p.y + ny * minD;
  const vn = ball.v.x * nx + ball.v.y * ny;
  if (vn < 0) {
    const j = -(1 + bm.e) * vn + bm.kick;
    ball.v.x += j * nx;
    ball.v.y += j * ny;
  }
  return true;
}

function launch(g: Game) {
  g.ball.p = { ...PLUNGER };
  g.ball.v = { x: 0, y: -(11 + g.charge * 10) };
  g.charge = 0;
  g.gateClosed = false;
  g.idle = 0;
  g.phase = "play";
}

function drain(g: Game) {
  g.ballsLeft -= 1;
  if (g.ballsLeft <= 0) {
    g.ballsLeft = 0;
    g.phase = "over";
  } else {
    g.phase = "ready";
    g.ball.p = { ...PLUNGER };
    g.ball.v = { x: 0, y: 0 };
    g.gateClosed = false;
  }
}

function updateFlippers(g: Game, active: boolean) {
  for (const f of g.flippers) {
    let target = f.restAngle;
    let blocked = false;

    if (f.pressed) {
      const near =
        active &&
        Math.hypot(g.ball.p.x - f.pivot.x, g.ball.p.y - f.pivot.y) < SAFETY_RADIUS;
      if (near) {
        // 안전장치. 공이 가까우므로 플리퍼를 내린다.
        blocked = true;
      } else {
        target = f.upAngle;
      }
    }

    if (blocked && !f.blocked) g.saves += 1;
    f.blocked = blocked;

    const max = FLIPPER_SPEED / SUB;
    const diff = target - f.angle;
    const stepAmt = Math.max(-max, Math.min(max, diff));
    f.angle += stepAmt;
    f.angVel = stepAmt * SUB;
  }
}

function substep(g: Game) {
  const active = g.phase === "play";
  updateFlippers(g, active);
  if (!active) return;

  const ball = g.ball;

  ball.v.y += GRAVITY / SUB;
  const sp = Math.hypot(ball.v.x, ball.v.y);
  if (sp > MAX_SPEED) {
    ball.v.x = (ball.v.x / sp) * MAX_SPEED;
    ball.v.y = (ball.v.y / sp) * MAX_SPEED;
  }
  ball.p.x += ball.v.x / SUB;
  ball.p.y += ball.v.y / SUB;

  for (const w of g.walls) {
    if (collideSegment(ball, w.a, w.b, 0, w.e, w.kick)) {
      if (w.score) {
        g.score += w.score;
        w.flash = 1;
      }
    }
  }

  if (g.gateClosed) collideSegment(ball, GATE.a, GATE.b, 0, GATE.e, 0);

  for (const bm of g.bumpers) {
    if (collideCircle(ball, bm)) {
      g.score += bm.score;
      bm.flash = 1;
    }
  }

  for (const f of g.flippers) {
    const tip = flipperTip(f);
    const n = collideSegment(ball, f.pivot, tip, FLIPPER_R, 0.5, 0, (c) => {
      // 접점의 표면 속도 = ω × r
      const rx = c.x - f.pivot.x;
      const ry = c.y - f.pivot.y;
      return { x: -ry * f.angVel, y: rx * f.angVel };
    });
    // 플리퍼가 올라가는 중에 공에 닿았는가? (이 값은 늘 0이다)
    if (n) {
      const rising = f.side === "left" ? f.angVel < -0.02 : f.angVel > 0.02;
      if (rising) g.hits += 1;
    }
  }

  // 발사 레인 역류 방지 게이트를 닫는다
  if (!g.gateClosed && ball.p.x < 300 && ball.p.y < 220) g.gateClosed = true;

  if (ball.p.y > DRAIN_Y && ball.p.x < 310) drain(g);
}

export function step(g: Game, input: Input) {
  for (const f of g.flippers) {
    const pressed = f.side === "left" ? input.left : input.right;
    if (pressed && !f.pressed) g.swings += 1;
    f.pressed = pressed;
  }

  if (g.phase === "ready") {
    if (input.space) {
      // 톡 누르면 약하게라도 나가야 한다
      g.charge = Math.min(1, Math.max(g.charge + 0.028, 0.14));
    } else if (g.prevSpace && g.charge > 0.02) {
      launch(g);
    }
  }
  g.prevSpace = input.space;

  if (g.phase === "play") g.elapsed += 1;

  for (let i = 0; i < SUB; i++) substep(g);

  // 어딘가에 끼어 멈춘 공 구제
  if (g.phase === "play") {
    const sp = Math.hypot(g.ball.v.x, g.ball.v.y);
    if (sp < 0.4) {
      g.idle += 1;
      if (g.idle > 90) {
        g.ball.v.x += (Math.random() - 0.5) * 2.5;
        g.ball.v.y += 1.5;
        g.idle = 0;
      }
    } else {
      g.idle = 0;
    }
    // 발사 레인으로 되돌아가 멈춘 경우
    if (g.ball.p.x > 310 && g.ball.p.y > 520 && sp < 0.6) drain(g);
  }

  for (const bm of g.bumpers) bm.flash *= 0.88;
  for (const w of g.walls) w.flash *= 0.88;
}
