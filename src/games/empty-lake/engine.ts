/**
 * 낚시 시뮬레이션.
 *
 * 캐스팅(파워·조준·포물선), 착수, 찌의 침하, 챔질, 릴 회수까지 전부 정상이다.
 * 뺀 것은 물고기 한 종류뿐이라 입질이 발생하는 경로가 존재하지 않는다.
 * 찌를 흔드는 것은 바람·잔물결·수초이고, 이것들이 만드는 침하율은
 * MAX_DIP에서 잘린다. 챔질 기준인 STRIKE_DIP(완전 침하)에는 닿지 않는다.
 */

export const W = 360;
export const H = 440;

/** 수평선. 이 아래가 전부 물이다. */
export const HORIZON = 148;
/** 발밑 물가 */
export const SHORE_Y = H - 18;

export const MIN_DIST = 4;
export const MAX_DIST = 28;

/** 챔질 기준. 찌가 완전히 잠긴 상태를 말한다. */
export const STRIKE_DIP = 1;
/** 이 호수에서 실제로 관측되는 침하율 상한 */
export const MAX_DIP = 0.62;

/** 낚싯대 끝. 화면 오른쪽 아래 바깥에서 들어온다. */
export const ROD_TIP = { x: W - 34, y: H - 96 };

export type Phase = "ready" | "charge" | "cast" | "wait" | "strike" | "reel";

/** 찌를 건드리는 것들. 전부 물고기가 아니다. */
const DISTURBANCES = [
  "잔물결",
  "바람",
  "수초",
  "저층 와류",
  "수면 부유물",
  "건너편 배의 여파",
] as const;

type Disturbance = {
  kind: string;
  /** 시작 시각(초) */
  at: number;
  dur: number;
  amp: number;
  /** 흔들림 횟수. 높으면 예신처럼 톡톡 끊긴다 */
  ticks: number;
};

export type Sim = {
  phase: Phase;
  /** 전체 경과(초) */
  t: number;
  /** 현재 페이즈 경과(초) */
  pt: number;
  /** 캐스팅 파워 0..1. charge 중 왕복한다 */
  power: number;
  powerDir: number;
  /** 좌우 조준 -1..1 */
  aim: number;
  /** 이번에 던진 거리(m) */
  dist: number;
  /** 찌의 화면 좌표와 원근 배율 */
  fx: number;
  fy: number;
  scale: number;
  /** 침하율 0..1. 1이면 완전히 잠긴 것 */
  dip: number;
  /** 이번 캐스팅의 최대 침하율 */
  peakDip: number;
  /** 착수 파문 진행도. 0이면 없음 */
  splash: number;
  /** 회수 중 물살 자국 */
  wake: number;
  /** 챔질 순간의 대 젖힘 0..1 */
  jerk: number;
  disturbance: Disturbance | null;
  nextAt: number;
  /** 지금 찌를 건드리는 것의 이름. 없으면 빈 문자열 */
  cause: string;
};

const TAU = Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createSim(): Sim {
  return {
    phase: "ready",
    t: 0,
    pt: 0,
    power: 0,
    powerDir: 1,
    aim: 0,
    dist: 0,
    fx: ROD_TIP.x,
    fy: ROD_TIP.y,
    scale: 1,
    dip: 0,
    peakDip: 0,
    splash: 0,
    wake: 0,
    jerk: 0,
    disturbance: null,
    nextAt: 0,
    cause: "",
  };
}

/** 거리(m) → 수면 위 y. 멀수록 수평선에 붙는다 */
export function distToY(dist: number): number {
  const t = clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  return lerp(SHORE_Y - 46, HORIZON + 22, Math.pow(t, 0.72));
}

/** 거리(m) → 원근 배율 */
export function distToScale(dist: number): number {
  const t = clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  return lerp(1, 0.4, Math.pow(t, 0.6));
}

/** 조준(-1..1) → x. 멀수록 좌우 폭이 좁아 보인다 */
export function aimToX(aim: number, dist: number): number {
  const t = clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  return W / 2 + aim * lerp(138, 54, t);
}

export function powerToDist(power: number): number {
  return MIN_DIST + (MAX_DIST - MIN_DIST) * power;
}

/** 파도에 의한 기본 흔들림. 물이 멈춰 있지는 않다 */
function baseDip(t: number): number {
  return 0.13 + 0.05 * Math.sin(t * 1.7) + 0.035 * Math.sin(t * 2.9 + 1.3);
}

function disturbanceDip(d: Disturbance, t: number): number {
  const u = (t - d.at) / d.dur;
  if (u < 0 || u > 1) return 0;
  const env = Math.pow(Math.sin(Math.PI * u), 0.7);
  const tick = 0.55 + 0.45 * Math.sin(u * TAU * d.ticks - Math.PI / 2);
  return d.amp * env * tick;
}

function scheduleDisturbance(sim: Sim) {
  const kind = DISTURBANCES[Math.floor(Math.random() * DISTURBANCES.length)];
  /** 가끔은 톡톡 끊기게 만든다. 예신과 구분이 안 되지만 예신은 아니다 */
  const teasing = Math.random() < 0.45;
  sim.disturbance = {
    kind,
    at: sim.t,
    dur: teasing ? 1.1 + Math.random() * 0.9 : 1.8 + Math.random() * 1.6,
    amp: 0.18 + Math.random() * 0.42,
    ticks: teasing ? 2 + Math.floor(Math.random() * 3) : 1,
  };
  sim.nextAt = sim.t + sim.disturbance.dur + 1.2 + Math.random() * 3.4;
}

export function beginCharge(sim: Sim) {
  if (sim.phase !== "ready") return;
  sim.phase = "charge";
  sim.pt = 0;
  sim.power = 0;
  sim.powerDir = 1;
}

export function releaseCast(sim: Sim) {
  if (sim.phase !== "charge") return;
  sim.phase = "cast";
  sim.pt = 0;
  sim.dist = powerToDist(sim.power);
  sim.scale = distToScale(sim.dist);
  sim.dip = 0;
  sim.peakDip = 0;
  sim.disturbance = null;
  sim.cause = "";
  sim.nextAt = 0;
}

export type Outcome = {
  dist: number;
  /** 챔질 순간의 침하율 */
  dip: number;
  /** 이번 캐스팅에서 관측된 최대 침하율 */
  peakDip: number;
  cause: string;
  waited: number;
};

/** 챔질. 걸린 것이 있으면 여기서 나오는데, 그런 것은 없다 */
export function hookSet(sim: Sim): Outcome | null {
  if (sim.phase !== "wait") return null;
  const out: Outcome = {
    dist: sim.dist,
    dip: sim.dip,
    peakDip: sim.peakDip,
    cause: sim.cause,
    waited: sim.pt,
  };
  sim.phase = "strike";
  sim.pt = 0;
  sim.jerk = 1;
  return out;
}

/** 챔질 없이 그냥 감아 들이기 */
export function reelIn(sim: Sim) {
  if (sim.phase !== "wait") return;
  sim.phase = "reel";
  sim.pt = 0;
}

export function step(sim: Sim, dt: number) {
  sim.t += dt;
  sim.pt += dt;
  if (sim.splash > 0) sim.splash = Math.max(0, sim.splash - dt * 1.1);
  if (sim.jerk > 0) sim.jerk = Math.max(0, sim.jerk - dt * 3);

  switch (sim.phase) {
    case "ready": {
      sim.fx = ROD_TIP.x;
      sim.fy = ROD_TIP.y;
      sim.scale = 1;
      sim.dip = 0;
      break;
    }
    case "charge": {
      /** 0→1→0을 왕복한다. 놓는 순간의 값이 그대로 거리가 된다 */
      sim.power += sim.powerDir * dt * 1.15;
      if (sim.power >= 1) {
        sim.power = 1;
        sim.powerDir = -1;
      } else if (sim.power <= 0) {
        sim.power = 0;
        sim.powerDir = 1;
      }
      break;
    }
    case "cast": {
      const target = { x: aimToX(sim.aim, sim.dist), y: distToY(sim.dist) };
      const dur = 0.62 + sim.dist * 0.016;
      const u = clamp(sim.pt / dur, 0, 1);
      sim.fx = lerp(ROD_TIP.x, target.x, u);
      sim.fy = lerp(ROD_TIP.y, target.y, u) - Math.sin(Math.PI * u) * (40 + sim.dist * 2.6);
      sim.scale = lerp(1, distToScale(sim.dist), u);
      if (u >= 1) {
        sim.phase = "wait";
        sim.pt = 0;
        sim.splash = 1;
        sim.nextAt = sim.t + 1.4 + Math.random() * 2;
      }
      break;
    }
    case "wait": {
      const target = { x: aimToX(sim.aim, sim.dist), y: distToY(sim.dist) };
      sim.fx = target.x + Math.sin(sim.t * 0.6) * 1.6 * sim.scale;
      sim.fy = target.y + Math.sin(sim.t * 1.7) * 1.4 * sim.scale;

      if (!sim.disturbance && sim.t >= sim.nextAt) scheduleDisturbance(sim);
      const d = sim.disturbance;
      const extra = d ? disturbanceDip(d, sim.t) : 0;
      if (d && sim.t > d.at + d.dur) sim.disturbance = null;

      /** 여기가 전부다. 무엇이 흔들든 침하율은 MAX_DIP에서 잘린다 */
      sim.dip = clamp(baseDip(sim.t) + extra, 0, MAX_DIP);
      sim.peakDip = Math.max(sim.peakDip, sim.dip);
      sim.cause = extra > 0.08 && d ? d.kind : "";
      break;
    }
    case "strike": {
      /** 대를 젖히면 찌가 수면 위로 튄다. 저항은 없다 */
      const u = clamp(sim.pt / 0.42, 0, 1);
      sim.dip = Math.max(0, sim.dip * (1 - u) - u * 0.35);
      sim.fy -= dt * 46 * (1 - u);
      sim.fx += (ROD_TIP.x - sim.fx) * dt * 1.1;
      if (u >= 1) {
        sim.phase = "reel";
        sim.pt = 0;
      }
      break;
    }
    case "reel": {
      const u = clamp(sim.pt / 0.95, 0, 1);
      const e = u * u * (3 - 2 * u);
      sim.fx = lerp(sim.fx, ROD_TIP.x, Math.min(1, dt * 6));
      sim.fy = lerp(sim.fy, ROD_TIP.y, Math.min(1, dt * 5));
      sim.scale = lerp(sim.scale, 1, Math.min(1, dt * 4));
      sim.wake = 1 - e;
      sim.dip = 0;
      sim.cause = "";
      if (u >= 1) {
        sim.phase = "ready";
        sim.pt = 0;
        sim.wake = 0;
        sim.power = 0;
        sim.powerDir = 1;
      }
      break;
    }
  }
}
