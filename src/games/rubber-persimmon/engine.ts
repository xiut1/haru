/**
 * 고무 감나무 물리.
 *
 * 나무는 마디(가지)마다 각스프링이 달린 사슬이다. 자식 가지는 부모 끝에 붙어 있고,
 * 부모가 홱 돌면 관성 때문에 반대로 처진다. 감쇠를 일부러 낮게 잡아서 놓으면
 * 고무처럼 한참 띠용거린다.
 *
 * 감은 가지 위 한 점에 꼭지로 매달린 진자다(베를레 적분 + 길이 고정).
 * 매 스텝 꼭지가 버틴 장력을 재고, 감마다 정해진 한계를 넘으면 떨어진다.
 * 가만히 매달려 있을 때 장력은 정확히 1g이다.
 *
 * 떨어진 감은 언덕에 떨어진다. 나무는 언덕 꼭대기에 있어서 어디로 떨어지든
 * 내리막이고, 감은 굴러서 화면 밖으로 나간다. 주울 수는 없다.
 */

export const W = 360;
export const H = 440;
export const G = 1800;
export const DT = 1 / 240;

const BASE = 410;
const HILL = 54;
const CX = W / 2;

/** 언덕 높이(y). 꼭대기는 나무 밑동이다. */
export function ground(x: number): number {
  const u = (x - CX) / (W / 2);
  return BASE - HILL * (1 - u * u);
}

function slope(x: number): number {
  return (2 * HILL * (x - CX)) / ((W / 2) * (W / 2));
}

type Branch = {
  parent: number;
  /** 부모 방향 기준 휴지각(rad). 양수 = 시계 방향 */
  rest: number;
  len: number;
  width: number;
  /** 각스프링 강성 (rad/s² per rad) */
  k: number;
};

const deg = (d: number) => (d * Math.PI) / 180;

export const BRANCHES: Branch[] = [
  { parent: -1, rest: deg(-90), len: 86, width: 17, k: 28 },
  { parent: 0, rest: deg(5), len: 62, width: 12, k: 42 },
  { parent: 0, rest: deg(-42), len: 72, width: 9, k: 50 },
  { parent: 2, rest: deg(20), len: 54, width: 6, k: 70 },
  { parent: 0, rest: deg(44), len: 74, width: 9, k: 50 },
  { parent: 4, rest: deg(-18), len: 54, width: 6, k: 70 },
  { parent: 1, rest: deg(-28), len: 56, width: 7, k: 60 },
  { parent: 1, rest: deg(30), len: 58, width: 7, k: 60 },
  { parent: 2, rest: deg(-36), len: 40, width: 5, k: 85 },
];

/** 감쇠. 낮을수록 오래 띠용거린다. */
const DAMP = 1.1;
/** 끌기 힘. 손을 따라오되 다 따라오진 않는다. 고무줄 느낌. */
const PULL = 2.6;
/** 부모 각가속도에 자식이 반대로 끌려가는 정도 */
const LAG = 0.2;
/** 이 각도까지는 선형 스프링. 넘으면 급격히 뻣뻣해진다. */
const SOFT = 0.6;
/** 꼭지 기준 덜렁거림 감쇠 (1/s). 감 꼭지는 짧고 뻣뻣하다. */
const STEM_DAMP = 7;
/** 장력 평활. 한 스텝짜리 튐으로는 안 떨어지게. */
const SMOOTH = 0.1;
/** 이 각도를 넘으면 고무가 급격히 뻣뻣해진다. 딱 멈추면 장력이 튀어서 안 된다. */
const HARD = 1.3;
/** HARD 너머 벽 강성(k 배수)과, 바깥으로 나가는 속도만 먹는 감쇠 (1/s) */
const WALL = 120;
const WALL_DAMP = 30;

export type Fruit = {
  id: number;
  branch: number;
  /** 가지 위 위치 0~1 */
  t: number;
  /** 꼭지 길이 */
  stem: number;
  /** 꼭지가 버티는 한계, g 단위 */
  hold: number;
};

export const FRUITS: Fruit[] = [
  { id: 0, branch: 3, t: 0.55, stem: 15, hold: 3.0 },
  { id: 1, branch: 3, t: 0.98, stem: 13, hold: 3.7 },
  { id: 2, branch: 5, t: 0.5, stem: 16, hold: 3.3 },
  { id: 3, branch: 5, t: 0.96, stem: 13, hold: 4.6 },
  // 꼭대기 두 가지는 원래 많이 휘청거린다. 그만큼 꼭지도 질기게.
  { id: 4, branch: 6, t: 0.85, stem: 14, hold: 6.4 },
  { id: 5, branch: 7, t: 0.75, stem: 15, hold: 8.0 },
  { id: 6, branch: 8, t: 0.95, stem: 14, hold: 5.6 },
];

export const FRUIT_R = 11;

/** 꼭지 끝에서 감 중심까지. 진자 길이는 꼭지 + 이것. */
export function reach(f: Fruit): number {
  return f.stem + FRUIT_R * 0.8;
}

type Vec = { x: number; y: number };

export type Seg = { x0: number; y0: number; x1: number; y1: number; angle: number };

export type Hanging = {
  state: "hang";
  p: Vec;
  pp: Vec;
  /** 최근 장력 (g). 조금 평활한 값 */
  tension: number;
};

export type Loose = {
  state: "fall";
  p: Vec;
  v: Vec;
  spin: number;
  landed: boolean;
};

export type FruitState = Hanging | Loose | { state: "gone" };

export type Grab = { branch: number; s: number; target: Vec };

export type Sim = {
  theta: number[];
  omega: number[];
  segs: Seg[];
  fruits: FruitState[];
  grab: Grab | null;
  /** 직전 스텝의 꼭지 위치 */
  pivots: Vec[];
  /** 이번 스텝에서 생긴 일 */
  events: SimEvent[];
};

export type SimEvent = { type: "drop"; id: number } | { type: "land"; id: number } | { type: "gone"; id: number };

export function pose(theta: number[]): Seg[] {
  const segs: Seg[] = [];
  BRANCHES.forEach((b, i) => {
    const base = b.parent < 0 ? { x: CX, y: ground(CX) + 4, angle: 0 } : {
      x: segs[b.parent].x1,
      y: segs[b.parent].y1,
      angle: segs[b.parent].angle,
    };
    const angle = base.angle + b.rest + theta[i];
    segs.push({
      x0: base.x,
      y0: base.y,
      x1: base.x + Math.cos(angle) * b.len,
      y1: base.y + Math.sin(angle) * b.len,
      angle,
    });
  });
  return segs;
}

export function along(seg: Seg, t: number): Vec {
  return { x: seg.x0 + (seg.x1 - seg.x0) * t, y: seg.y0 + (seg.y1 - seg.y0) * t };
}

function chain(i: number): number[] {
  const out: number[] = [];
  for (let j = i; j >= 0; j = BRANCHES[j].parent) out.push(j);
  return out;
}
const CHAINS = BRANCHES.map((_, i) => chain(i));

/**
 * 새 철이 열려도 나무는 흔들리던 그대로 이어서 흔들린다. 그래서 자세를 넘겨받으면
 * 그 자세 기준으로 감을 매단다. 쉬는 자세 기준으로 매달면 첫 스텝에 꼭지가 순간이동해서
 * 갓 열린 감이 전부 떨어진다.
 */
export function createSim(left: number[], from?: { theta: number[]; omega: number[] }): Sim {
  const theta = from ? [...from.theta] : BRANCHES.map(() => 0);
  const segs = pose(theta);
  return {
    theta,
    omega: from ? [...from.omega] : BRANCHES.map(() => 0),
    segs,
    fruits: FRUITS.map((f) => {
      if (!left.includes(f.id)) return { state: "gone" };
      const a = along(segs[f.branch], f.t);
      const p = { x: a.x, y: a.y + reach(f) };
      return { state: "hang", p, pp: { ...p }, tension: 1 };
    }),
    grab: null,
    pivots: FRUITS.map((f) => along(segs[f.branch], f.t)),
    events: [],
  };
}

/** 가장 가까운 가지 위 점. 잎 덩어리까지 쳐서 넉넉하게 잡힌다. */
export function pick(sim: Sim, x: number, y: number, reach = 46): { branch: number; s: number } | null {
  let best: { branch: number; s: number; d: number } | null = null;
  sim.segs.forEach((seg, i) => {
    const dx = seg.x1 - seg.x0;
    const dy = seg.y1 - seg.y0;
    const s = Math.max(0, Math.min(1, ((x - seg.x0) * dx + (y - seg.y0) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(seg.x0 + dx * s - x, seg.y0 + dy * s - y);
    // 밑동은 잡아도 흔들 맛이 없으니 위쪽으로 조금 올려 잡는다.
    if (!best || d < best.d) best = { branch: i, s: i === 0 ? Math.max(s, 0.6) : s, d };
  });
  if (!best) return null;
  const b: { branch: number; s: number; d: number } = best;
  return b.d <= reach ? { branch: b.branch, s: b.s } : null;
}

function stepTree(sim: Sim) {
  const { theta, omega } = sim;
  const segs = sim.segs;
  const drive = BRANCHES.map(() => 0);

  if (sim.grab) {
    const { branch, s, target } = sim.grab;
    const at = along(segs[branch], s);
    const dx = target.x - at.x;
    const dy = target.y - at.y;
    for (const j of CHAINS[branch]) {
      const rx = at.x - segs[j].x0;
      const ry = at.y - segs[j].y0;
      const r = Math.hypot(rx, ry);
      const cross = rx * dy - ry * dx;
      drive[j] = (PULL * BRANCHES[j].k * cross) / (r * r + 40 * r + 1);
    }
  }

  const alphaWorld: number[] = [];
  BRANCHES.forEach((b, i) => {
    const parentAlpha = b.parent < 0 ? 0 : alphaWorld[b.parent];
    const over = Math.max(0, Math.abs(theta[i]) - SOFT);
    const stop = 48 * b.k * over * over * Math.sign(theta[i]);
    // HARD 너머는 벽이지만 고무벽이다. 몇 스텝에 걸쳐 세운다.
    const past = Math.max(0, Math.abs(theta[i]) - HARD);
    const outward = past > 0 && omega[i] * theta[i] > 0;
    const wall = WALL * b.k * past * Math.sign(theta[i]) + (outward ? WALL_DAMP * omega[i] : 0);
    const a = -b.k * theta[i] - stop - wall - DAMP * omega[i] + drive[i] - LAG * parentAlpha;
    alphaWorld.push(parentAlpha + a);
    omega[i] += a * DT;
    theta[i] += omega[i] * DT;
  });

  sim.segs = pose(theta);
}

function stepFruits(sim: Sim) {
  const g = G * DT * DT;
  const pivots = FRUITS.map((f) => along(sim.segs[f.branch], f.t));
  sim.fruits = sim.fruits.map((f, id) => {
    if (f.state === "gone") return f;
    const spec = FRUITS[id];

    if (f.state === "hang") {
      const a = pivots[id];
      const prev = sim.pivots[id];
      // 꼭지 기준으로 덜렁거리는 속도만 죽인다. 가지와 같이 움직이는 건 그대로.
      const keep = 1 - STEM_DAMP * DT;
      const pvx = a.x - prev.x;
      const pvy = a.y - prev.y;
      const nx = f.p.x + pvx + (f.p.x - f.pp.x - pvx) * keep;
      const ny = f.p.y + pvy + (f.p.y - f.pp.y - pvy) * keep + g;
      const dx = nx - a.x;
      const dy = ny - a.y;
      const d = Math.hypot(dx, dy);
      let px = nx;
      let py = ny;
      let pull = 0;
      const L = reach(spec);
      if (d > L) {
        px = a.x + (dx / d) * L;
        py = a.y + (dy / d) * L;
        pull = (d - L) / (DT * DT) / G;
      }
      const tension = f.tension * (1 - SMOOTH) + pull * SMOOTH;
      if (tension > spec.hold) {
        sim.events.push({ type: "drop", id });
        return {
          state: "fall",
          p: { x: px, y: py },
          v: { x: (px - f.p.x) / DT, y: (py - f.p.y) / DT },
          spin: 0,
          landed: false,
        };
      }
      return { state: "hang", p: { x: px, y: py }, pp: f.p, tension };
    }

    const v = { x: f.v.x, y: f.v.y + G * DT };
    const p = { x: f.p.x + v.x * DT, y: f.p.y + v.y * DT };
    let { spin, landed } = f;
    const floor = ground(p.x) - FRUIT_R;
    if (p.y >= floor) {
      p.y = floor;
      const s = slope(p.x);
      const n = Math.hypot(s, 1);
      const nx = s / n;
      const ny = -1 / n;
      const vn = v.x * nx + v.y * ny;
      if (vn < 0) {
        const e = vn < -120 ? 0.38 : 0;
        v.x -= (1 + e) * vn * nx;
        v.y -= (1 + e) * vn * ny;
        if (!landed) sim.events.push({ type: "land", id });
        landed = true;
      }
      // 구름 저항 아주 조금. 멈출 만큼은 아니다.
      v.x *= 0.999;
      // 꼭대기에 딱 서는 일은 없게.
      if (Math.abs(v.x) < 4 && Math.abs(p.x - CX) < 6) v.x += p.x >= CX ? 8 : -8;
      const tx = 1 / n;
      const ty = s / n;
      spin += ((v.x * tx + v.y * ty) / FRUIT_R) * DT;
    }
    if (p.x < -FRUIT_R * 2 || p.x > W + FRUIT_R * 2) {
      sim.events.push({ type: "gone", id });
      return { state: "gone" };
    }
    return { state: "fall", p, v, spin, landed };
  });
  sim.pivots = pivots;
}

export function step(sim: Sim) {
  stepTree(sim);
  stepFruits(sim);
}
