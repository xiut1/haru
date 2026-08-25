/**
 * 사이드스크롤 비행 게임.
 *
 * 중력·플랩 임펄스·낙하 속도 상한·기체 피치·파이프 스크롤·통과 판정까지
 * 원본 그대로다. 히트박스도 원본 관례를 따라 몸통 기준으로 잡았다.
 *
 * 뺀 것은 여유 공간 1px뿐이다.
 * 새 몸통은 BIRD_H(26px), 파이프 간격은 GAP(25px).
 * 새를 간격 정중앙에 놓아도 위아래로 0.5px씩 파고들기 때문에
 * 통과 경로가 존재하지 않는다. 조작으로 줄일 수 있는 하한은 MIN_CLIP이다.
 */

export const W = 360;
export const H = 480;

/** 지면 두께 */
export const GROUND_H = 76;
export const GROUND_Y = H - GROUND_H;

/** 새 히트박스. 원본과 같이 몸통 기준이고 부리·꼬리·날개는 뺀다. */
export const BIRD_W = 28;
export const BIRD_H = 26;
/** 새는 x축으로 움직이지 않는다. 세상이 움직인다. */
export const BIRD_X = 92;

/** 파이프 사이 간격. 새 몸통보다 정확히 1px 좁다. */
export const GAP = 25;
export const PIPE_W = 58;
export const PIPE_CAP_H = 26;
export const PIPE_SPACING = 200;
export const PIPE_SPEED = 2.05;

/** 간격 상단이 놓일 수 있는 범위 */
const GAP_MIN_Y = 68;
const GAP_MAX_Y = GROUND_Y - 68 - GAP;

const GRAVITY = 0.42;
const FLAP_V = -7.1;
const MAX_FALL = 11.5;
const HIT_GRAVITY = 0.5;

/** 새를 간격 정중앙에 완벽히 맞췄을 때 남는 겹침. 0이 될 수 없다. */
export const MIN_CLIP = (BIRD_H - GAP) / 2;

export type Phase = "ready" | "play" | "hit" | "over";

export type Pipe = {
  x: number;
  gapTop: number;
  scored: boolean;
};

export type HitInfo = {
  kind: "pipe" | "ground";
  /** 위쪽 파이프에 파고든 양(px). 음수면 안 닿은 것 */
  top: number;
  /** 아래쪽 파이프에 파고든 양(px) */
  bottom: number;
  /** 실제로 걸린 양. max(top, bottom) */
  clip: number;
};

export type Sim = {
  phase: Phase;
  /** 프레임 카운터 */
  t: number;
  /** 이번 비행의 프레임 수 */
  air: number;
  /** 새 히트박스 상단 y */
  by: number;
  vy: number;
  /** 기체 피치(라디안) */
  rot: number;
  /** 날갯짓 위상 */
  wing: number;
  wingBoost: number;
  pipes: Pipe[];
  score: number;
  flaps: number;
  ground: number;
  bob: number;
  hit: HitInfo | null;
  flash: number;
  shake: number;
};

const READY_Y = (GROUND_Y - BIRD_H) / 2 - 10;

function makePipe(x: number): Pipe {
  return {
    x,
    gapTop: GAP_MIN_Y + Math.random() * (GAP_MAX_Y - GAP_MIN_Y),
    scored: false,
  };
}

export function createSim(): Sim {
  return {
    phase: "ready",
    t: 0,
    air: 0,
    by: READY_Y,
    vy: 0,
    rot: 0,
    wing: 0,
    wingBoost: 0,
    pipes: [],
    score: 0,
    flaps: 0,
    ground: 0,
    bob: 0,
    hit: null,
    flash: 0,
    shake: 0,
  };
}

/** 새 히트박스가 이 파이프에 얼마나 파고들었는지. 안 닿았으면 null */
function overlap(p: Pipe, by: number): HitInfo | null {
  const top = p.gapTop - by;
  const bottom = by + BIRD_H - (p.gapTop + GAP);
  if (top <= 0 && bottom <= 0) return null;
  return { kind: "pipe", top, bottom, clip: Math.max(top, bottom) };
}

function refill(sim: Sim) {
  while (sim.pipes.length > 0 && sim.pipes[0].x + PIPE_W < -20) sim.pipes.shift();
  while (sim.pipes.length < 4) {
    const last = sim.pipes[sim.pipes.length - 1];
    sim.pipes.push(makePipe(last ? last.x + PIPE_SPACING : W + 130));
  }
}

export function step(sim: Sim, flap: boolean) {
  sim.t += 1;
  if (sim.flash > 0) sim.flash -= 1;
  if (sim.shake > 0) sim.shake -= 1;
  if (sim.wingBoost > 0) sim.wingBoost -= 1;

  // 날갯짓. 플랩 직후에 빨라진다
  sim.wing += sim.wingBoost > 0 ? 0.42 : sim.phase === "hit" ? 0.05 : 0.17;

  // 지면은 파이프와 같은 속도로 흐른다
  if (sim.phase !== "over") sim.ground = (sim.ground + PIPE_SPEED) % 24;

  if (sim.phase === "ready") {
    sim.bob += 0.055;
    sim.by = READY_Y + Math.sin(sim.bob) * 5;
    sim.rot = Math.sin(sim.bob) * 0.06;
    if (flap) {
      sim.phase = "play";
      sim.vy = FLAP_V;
      sim.flaps += 1;
      sim.wingBoost = 8;
      refill(sim);
    }
    return;
  }

  if (sim.phase === "play") {
    sim.air += 1;

    if (flap) {
      sim.vy = FLAP_V;
      sim.flaps += 1;
      sim.wingBoost = 8;
    }

    sim.vy = Math.min(sim.vy + GRAVITY, MAX_FALL);
    sim.by += sim.vy;

    // 원본과 같이 천장에서는 죽지 않고 막힌다
    if (sim.by < 0) {
      sim.by = 0;
      if (sim.vy < 0) sim.vy = 0;
    }

    for (const p of sim.pipes) p.x -= PIPE_SPEED;
    refill(sim);

    // 통과 판정. 도달하는 경로가 없을 뿐 판정 자체는 정상이다
    for (const p of sim.pipes) {
      if (!p.scored && p.x + PIPE_W < BIRD_X) {
        p.scored = true;
        sim.score += 1;
      }
    }

    // 지면
    if (sim.by + BIRD_H >= GROUND_Y) {
      sim.by = GROUND_Y - BIRD_H;
      sim.hit = { kind: "ground", top: 0, bottom: 0, clip: 0 };
      sim.phase = "over";
      sim.flash = 4;
      sim.shake = 10;
      sim.vy = 0;
      return;
    }

    // 파이프
    for (const p of sim.pipes) {
      if (BIRD_X + BIRD_W <= p.x || BIRD_X >= p.x + PIPE_W) continue;
      const info = overlap(p, sim.by);
      if (!info) continue;
      sim.hit = info;
      sim.phase = "hit";
      sim.flash = 4;
      sim.shake = 12;
      sim.vy = -2.2;
      // 파이프 앞면에 걸려 멈춘다
      p.x = BIRD_X + BIRD_W;
      return;
    }

    // 피치. 올라갈 땐 고개를 들고 떨어질수록 숙인다
    const target = sim.vy < 0 ? -0.42 : Math.min(1.5, sim.vy * 0.13);
    sim.rot += (target - sim.rot) * 0.22;
    return;
  }

  if (sim.phase === "hit") {
    sim.vy = Math.min(sim.vy + HIT_GRAVITY, MAX_FALL);
    sim.by += sim.vy;
    sim.rot = Math.min(1.57, sim.rot + 0.13);
    if (sim.by + BIRD_H >= GROUND_Y) {
      sim.by = GROUND_Y - BIRD_H;
      sim.phase = "over";
      sim.shake = 6;
    }
  }
}
