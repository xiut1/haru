"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 덕 헌트다. 오리 열 마리, 마리당 세 발, 라운드 통과 기준 6마리.
 * 조준선, 히트박스, 명중 판정, 오리의 비행과 도주까지 전부 원본대로 굴러간다.
 * 조준선이 가리키는 곳도 정확하다. 거짓말은 하나도 안 한다.
 *
 * 다만 지급되는 탄이 0.20g 비비탄이다. 가벼워서 측풍에 그대로 밀리고,
 * 홉업이 과해서 위로 뜨고, 회전이 걸려서 휘어 나간다. 탄은 조준점이 아니라
 * 조준점 + 편차에 도달하고, 명중 판정은 「탄이 실제로 간 곳」으로 한다.
 *
 * 그리고 어쩌다 맞아도 발당 운동에너지가 0.34~0.38J이라 격추 임계치 1.00J에
 * 못 미친다. 판정식은 멀쩡히 들어 있다. 오리는 톡 하고 휘청였다가 날아간다.
 */

const DUCKS_PER_ROUND = 10;
const SHELLS_PER_DUCK = 3;
/** 라운드 통과에 필요한 격추 수. 원본과 같다 */
const PASS_LINE = 6;
/** 이 시간이 지나면 오리가 날아간다 */
const ESCAPE_MS = 7000;

/** 비비탄 제원 */
const PELLET_G = 0.2;
const MUZZLE_MIN = 58;
const MUZZLE_MAX = 62;
/** 오리를 떨어뜨리는 데 필요한 운동에너지 */
const DROP_J = 1.0;

/** 화면 가로를 실제 몇 미터로 치는지. 편차를 미터로 환산할 때 쓴다 */
const FIELD_M = 20;

/** 총구 위치(필드 좌표 %) */
const MUZZLE_X = 50;
const MUZZLE_Y = 104;

/** E = ½mv². 그램을 킬로그램으로 고쳐 넣는다 */
function energyOf(v: number): number {
  return 0.5 * (PELLET_G / 1000) * v * v;
}

/** 지금 부는 바람. 느린 성분과 빠른 성분을 겹쳐서 계속 변한다 */
function windAt(now: number): number {
  const t = now / 1000;
  return (
    3.4 * Math.sin(t / 2.7) +
    1.9 * Math.sin(t / 0.83 + 1.1) +
    0.9 * Math.sin(t / 0.31 + 2.4)
  );
}

type Duck = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  spawnedAt: number;
  turnAt: number;
  staggerUntil: number;
  flinchAt: number;
  hits: number;
  state: "fly" | "escape";
};

/** 날아가는 중인 비비탄 한 발 */
type Pellet = {
  id: number;
  ax: number;
  ay: number;
  /** 도달 지점의 편차(%) */
  dx: number;
  dy: number;
  /** 회전 때문에 도중에 좌우로 흔들리는 폭 */
  wob: number;
  wobPhase: number;
  at: number;
  dur: number;
  energy: number;
};

type Mark = "pending" | "current" | "missed" | "grazed" | "downed";

type Impact = {
  id: number;
  kind: "hit" | "miss";
  x: number;
  y: number;
  vx: number;
  vy: number;
  at: number;
  energy: number;
  /** 조준점에서 벗어난 거리(m) */
  drift: number;
  side: "좌" | "우";
  /** 이 탄이 실제로 지나온 길. 잠깐 남겨서 보여 준다 */
  path: string;
};

type View = {
  duck: Duck | null;
  wobble: number;
  flap: number;
  shells: number;
  index: number;
  hits: number;
  shots: number;
  downed: number;
  marks: Mark[];
  wind: number;
  pellets: { id: number; x: number; y: number; trail: string }[];
  impacts: {
    id: number;
    kind: "hit" | "miss";
    x: number;
    y: number;
    energy: number;
    drift: number;
    side: "좌" | "우";
    path: string;
    p: number;
  }[];
};

const EMPTY_VIEW: View = {
  duck: null,
  wobble: 0,
  flap: 0,
  shells: SHELLS_PER_DUCK,
  index: 0,
  hits: 0,
  shots: 0,
  downed: 0,
  marks: new Array(DUCKS_PER_ROUND).fill("pending") as Mark[],
  wind: 0,
  pellets: [],
  impacts: [],
};

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function newDuck(now: number): Duck {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const speed = rand(19, 26);
  const ang = rand(-0.45, 0.45);
  return {
    x: dir === 1 ? 12 : 88,
    y: rand(46, 62),
    vx: Math.cos(ang) * speed * dir,
    vy: -Math.abs(Math.sin(ang) * speed) - 6,
    facing: dir === 1 ? 1 : -1,
    spawnedAt: now,
    turnAt: now + rand(700, 1300),
    staggerUntil: 0,
    flinchAt: -9999,
    hits: 0,
    state: "fly",
  };
}

/** 방향 전환. 속도는 유지하고 각도만 바꾼다 */
function retarget(d: Duck, now: number) {
  const speed = rand(19, 27);
  const ang = rand(0, Math.PI * 2);
  d.vx = Math.cos(ang) * speed;
  d.vy = Math.sin(ang) * speed * 0.7;
  d.turnAt = now + rand(650, 1250);
}

/** 발사 시점에 이 한 발의 팔자를 정해 둔다 */
function newPellet(
  id: number,
  ax: number,
  ay: number,
  now: number,
  wind: number,
): Pellet {
  const dist = Math.hypot(ax - MUZZLE_X, ay - MUZZLE_Y) / 100;
  return {
    id,
    ax,
    ay,
    // 측풍은 가벼운 탄을 그대로 민다. 거리가 멀수록 더 밀린다
    dx: wind * 1.7 * (0.5 + dist) + rand(-3.2, 3.2),
    // 홉업이 과하면 위로 뜬다. 가끔은 덜 먹어서 가라앉는다
    dy: rand(-9.5, 2.6),
    wob: rand(1.8, 4.4) * (Math.random() < 0.5 ? -1 : 1),
    wobPhase: rand(0, Math.PI * 2),
    at: now,
    dur: 150 + dist * 110,
    energy: energyOf(rand(MUZZLE_MIN, MUZZLE_MAX)),
  };
}

/** 비행 중 위치. 편차는 t²로 붙어서 휘는 모양이 된다 */
function pelletAt(p: Pellet, t: number): { x: number; y: number } {
  const e = t * t;
  return {
    x:
      MUZZLE_X +
      (p.ax - MUZZLE_X) * t +
      p.dx * e +
      Math.sin(t * 9 + p.wobPhase) * p.wob * t,
    y: MUZZLE_Y + (p.ay - MUZZLE_Y) * t + p.dy * e,
  };
}

/** 이 탄이 지나온 길을 폴리라인 좌표로 뽑는다 */
function pathOf(p: Pellet): string {
  const pts: string[] = [];
  for (let k = 0; k <= 14; k += 1) {
    const q = pelletAt(p, k / 14);
    pts.push(`${q.x.toFixed(2)},${q.y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function comment(shots: number, hits: number, drift: number): string {
  if (shots === 0) return "한 발도 안 쏘셨습니다. 탄값은 아끼셨습니다.";
  if (hits === 0)
    return `평균 ${drift.toFixed(1)}m씩 벗어났습니다. 조준선은 제자리에 있었습니다.`;
  if (hits === shots)
    return `${shots}발이 전부 어딘가에 맞았습니다. 오리는 그때마다 휘청였다가 다시 날아갔습니다.`;
  return `${hits}번 맞히셨습니다. 맞은 건 오리도 압니다. 다만 떨어질 이유는 없었습니다.`;
}

export default function Game() {
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [view, setView] = useState<View>(EMPTY_VIEW);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [maxJ, setMaxJ] = useState(0);
  const [grazed, setGrazed] = useState(0);
  const [drift, setDrift] = useState({ sum: 0, n: 0, max: 0 });

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const duckRef = useRef<Duck | null>(null);
  const marksRef = useRef<Mark[]>(new Array(DUCKS_PER_ROUND).fill("pending"));
  const pelletsRef = useRef<Pellet[]>([]);
  const impactsRef = useRef<Impact[]>([]);
  const idRef = useRef(0);
  const stateRef = useRef({
    index: 0,
    shells: SHELLS_PER_DUCK,
    shots: 0,
    hits: 0,
    downed: 0,
    spawnAt: 0,
    dryAt: 0,
  });

  useEffect(() => {
    if (phase !== "play") return;

    let raf = 0;
    let last = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(48, now - last) / 1000;
      last = now;

      const s = stateRef.current;

      // 다음 오리를 내보낸다
      if (!duckRef.current && s.index < DUCKS_PER_ROUND && now >= s.spawnAt) {
        duckRef.current = newDuck(now);
        s.shells = SHELLS_PER_DUCK;
        s.dryAt = 0;
        marksRef.current[s.index] = "current";
      }

      const d = duckRef.current;
      if (d) {
        const slow = now < d.staggerUntil ? 0.32 : 1;
        d.x += d.vx * dt * slow;
        d.y += d.vy * dt * slow;

        if (d.state === "fly") {
          if (d.x < 6) {
            d.x = 6;
            d.vx = Math.abs(d.vx);
          }
          if (d.x > 94) {
            d.x = 94;
            d.vx = -Math.abs(d.vx);
          }
          if (d.y < 10) {
            d.y = 10;
            d.vy = Math.abs(d.vy);
          }
          if (d.y > 64) {
            d.y = 64;
            d.vy = -Math.abs(d.vy);
          }
          if (now >= d.turnAt) retarget(d, now);
          d.facing = d.vx >= 0 ? 1 : -1;

          // 탄이 떨어졌거나 시간이 다 되면 날아간다
          const dry = s.shells === 0 && s.dryAt > 0 && now - s.dryAt > 700;
          if (dry || now - d.spawnedAt > ESCAPE_MS) {
            d.state = "escape";
            d.vx *= 0.6;
            d.vy = -78;
          }
        } else {
          d.vy = -78;
          d.facing = d.vx >= 0 ? 1 : -1;
          if (d.y < -30) {
            marksRef.current[s.index] = d.hits > 0 ? "grazed" : "missed";
            if (d.hits > 0) setGrazed((n) => n + 1);
            duckRef.current = null;
            s.index += 1;
            s.spawnAt = now + 620;
          }
        }
      }

      // 날아가는 탄. 도착한 것부터 판정한다
      const flying: Pellet[] = [];
      for (const p of pelletsRef.current) {
        if (now - p.at < p.dur) {
          flying.push(p);
          continue;
        }

        const end = pelletAt(p, 1);
        const off = Math.hypot(end.x - p.ax, end.y - p.ay);
        const driftM = (off / 100) * FIELD_M;
        const side: "좌" | "우" = end.x < p.ax ? "좌" : "우";
        setDrift((prev) => ({
          sum: prev.sum + driftM,
          n: prev.n + 1,
          max: Math.max(prev.max, driftM),
        }));

        // 히트박스. 탄이 실제로 도달한 지점으로 잰다
        const cur = duckRef.current;
        let hit = false;
        if (cur && cur.state === "fly") {
          const rect = fieldRef.current?.getBoundingClientRect();
          const ratio = rect ? rect.height / rect.width : 0.625;
          const ex = end.x - cur.x;
          // 세로는 화면 비율만큼 눌러서 원래 타원 그대로 잰다
          const ey = (end.y - cur.y) * ratio;
          hit = (ex / 5.8) ** 2 + (ey / 4.5) ** 2 <= 1;
        }

        idRef.current += 1;
        impactsRef.current.push({
          id: idRef.current,
          kind: hit ? "hit" : "miss",
          x: end.x,
          y: end.y,
          vx: rand(-1, 1),
          vy: rand(-1, -0.2),
          at: now,
          energy: p.energy,
          drift: driftM,
          side,
          path: pathOf(p),
        });

        if (hit && cur) {
          s.hits += 1;
          cur.hits += 1;
          cur.flinchAt = now;
          cur.staggerUntil = now + 190;
          setMaxJ((prev) => Math.max(prev, p.energy));

          // 맞은 방향으로 아주 조금 밀린다
          const ux = cur.x - MUZZLE_X;
          const uy = cur.y - MUZZLE_Y;
          const len = Math.hypot(ux, uy) || 1;
          cur.vx += (ux / len) * 7;
          cur.vy += (uy / len) * 7;
          const sp = Math.hypot(cur.vx, cur.vy);
          if (sp > 32) {
            cur.vx = (cur.vx / sp) * 32;
            cur.vy = (cur.vy / sp) * 32;
          }

          // 격추 판정. 임계치를 넘으면 떨어진다
          if (p.energy >= DROP_J) {
            s.downed += 1;
            marksRef.current[s.index] = "downed";
            duckRef.current = null;
            s.index += 1;
            s.spawnAt = now + 620;
          }
        }
      }
      pelletsRef.current = flying;

      impactsRef.current = impactsRef.current.filter((im) => now - im.at < 620);

      const cur = duckRef.current;
      const since = cur ? now - cur.flinchAt : 9999;
      setView({
        duck: cur ? { ...cur } : null,
        wobble: since < 300 ? Math.sin(since / 22) * 16 * (1 - since / 300) : 0,
        flap: now / 1000,
        shells: s.shells,
        index: s.index,
        hits: s.hits,
        shots: s.shots,
        downed: s.downed,
        marks: [...marksRef.current],
        wind: windAt(now),
        pellets: flying.map((p) => {
          const t = (now - p.at) / p.dur;
          const here = pelletAt(p, t);
          // 지나온 자리를 조금 남긴다. 휘는 게 보여야 한다
          const pts: string[] = [];
          for (let k = 6; k >= 0; k -= 1) {
            const tt = Math.max(0, t - k * 0.055);
            const q = pelletAt(p, tt);
            pts.push(`${q.x.toFixed(2)},${q.y.toFixed(2)}`);
          }
          return { id: p.id, x: here.x, y: here.y, trail: pts.join(" ") };
        }),
        impacts: impactsRef.current.map((im) => {
          const q = (now - im.at) / 620;
          return {
            id: im.id,
            kind: im.kind,
            x: im.x + im.vx * q * 22,
            y: im.y + im.vy * q * 22 + 30 * q * q,
            energy: im.energy,
            drift: im.drift,
            side: im.side,
            path: im.path,
            p: q,
          };
        }),
      });

      if (
        !duckRef.current &&
        s.index >= DUCKS_PER_ROUND &&
        pelletsRef.current.length === 0
      ) {
        setPhase("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /** 사격. 조준점은 정확히 받아 적고, 탄이 어디로 갈지는 탄이 정한다 */
  const shoot = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (phase !== "play") return;
      const el = fieldRef.current;
      if (!el) return;
      const s = stateRef.current;
      if (s.shells <= 0) return;

      const r = el.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * 100;
      const py = ((ev.clientY - r.top) / r.height) * 100;
      const now = performance.now();
      // 손가락으로 쏘면 pointermove가 없다. 조준선은 여기서도 맞춰 둔다
      setAim({ x: px, y: py });

      s.shells -= 1;
      s.shots += 1;
      if (s.shells === 0) s.dryAt = now;

      idRef.current += 1;
      pelletsRef.current.push(
        newPellet(idRef.current, px, py, now, windAt(now)),
      );
    },
    [phase],
  );

  function start() {
    stateRef.current = {
      index: 0,
      shells: SHELLS_PER_DUCK,
      shots: 0,
      hits: 0,
      downed: 0,
      spawnAt: 0,
      dryAt: 0,
    };
    duckRef.current = null;
    marksRef.current = new Array(DUCKS_PER_ROUND).fill("pending");
    pelletsRef.current = [];
    impactsRef.current = [];
    setMaxJ(0);
    setGrazed(0);
    setDrift({ sum: 0, n: 0, max: 0 });
    setView(EMPTY_VIEW);
    setPhase("play");
  }

  const d = view.duck;
  const flapAngle = d
    ? Math.sin(view.flap * (d.state === "escape" ? 22 : 13)) * 42
    : 0;
  const accuracy = view.shots > 0 ? (view.hits / view.shots) * 100 : 0;
  const avgDrift = drift.n > 0 ? drift.sum / drift.n : 0;
  const wind = view.wind;
  // 판정 표시는 제일 마지막 한 발만 띄운다. 겹치면 읽을 수가 없다
  const lastImpact =
    view.impacts.length > 0 ? view.impacts[view.impacts.length - 1].id : -1;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 계기판 */}
      <div className="flex w-full max-w-xl items-end justify-between">
        <div>
          <p className="text-xs opacity-60">격추</p>
          <p className="text-3xl font-bold tabular-nums">
            {view.downed}
            <span className="text-base opacity-50"> / {PASS_LINE}</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs opacity-60">명중</p>
          <p className="text-3xl font-bold tabular-nums">{view.hits}</p>
        </div>
        <div className="text-center">
          <p className="text-xs opacity-60">오리</p>
          <p className="text-3xl font-bold tabular-nums">
            {Math.min(view.index + 1, DUCKS_PER_ROUND)}
            <span className="text-base opacity-50"> / {DUCKS_PER_ROUND}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-60">남은 탄</p>
          <p className="flex justify-end gap-1 pt-2">
            {Array.from({ length: SHELLS_PER_DUCK }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full border border-foreground/40 ${
                  i < view.shells ? "bg-amber-400" : "bg-transparent"
                }`}
              />
            ))}
          </p>
        </div>
      </div>

      {/* 사냥터 */}
      <div
        ref={fieldRef}
        onPointerDown={shoot}
        onPointerMove={(e) => {
          const el = fieldRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          setAim({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
          });
        }}
        onPointerLeave={() => setAim(null)}
        className="relative aspect-[16/10] w-full max-w-xl select-none overflow-hidden rounded-2xl bg-gradient-to-b from-sky-500 to-sky-300 shadow-inner"
        style={{ cursor: phase === "play" ? "none" : "default" }}
      >
        {/* 구름 */}
        <span className="absolute left-[12%] top-[14%] h-[7%] w-[22%] rounded-full bg-white/70" />
        <span className="absolute left-[20%] top-[9%] h-[8%] w-[14%] rounded-full bg-white/70" />
        <span className="absolute right-[14%] top-[22%] h-[6%] w-[18%] rounded-full bg-white/60" />

        {/* 풍향계. 지금 부는 바람을 그대로 보여 준다 */}
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-stone-900/70 px-2 py-1 text-xs font-bold text-white">
          <span className="opacity-70">측풍</span>
          <span
            className="inline-block text-base leading-none transition-transform"
            style={{ transform: `scaleX(${wind < 0 ? -1 : 1})` }}
          >
            →
          </span>
          <span className="tabular-nums">{Math.abs(wind).toFixed(1)} m/s</span>
          {Math.abs(wind) > 4.5 && (
            <span className="rounded bg-amber-400 px-1 text-[10px] text-stone-900">
              돌풍
            </span>
          )}
        </div>

        {/* 수풀 */}
        <div className="absolute inset-x-0 bottom-0 h-[22%] bg-emerald-700" />
        <div className="absolute inset-x-0 bottom-[16%] h-[10%] rounded-[50%] bg-emerald-600" />

        {/* 오리 */}
        {d && (
          <div
            className="absolute"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: "13%",
              transform: `translate(-50%, -50%) rotate(${view.wobble}deg) scaleX(${d.facing})`,
            }}
          >
            <svg viewBox="0 0 100 74" className="w-full">
              {/* 몸통 */}
              <ellipse cx="46" cy="44" rx="30" ry="20" fill="#1f2937" />
              <ellipse cx="42" cy="50" rx="22" ry="12" fill="#f8fafc" />
              {/* 꼬리 */}
              <path d="M16 40 L2 30 L6 46 Z" fill="#1f2937" />
              {/* 목과 머리 */}
              <path
                d="M62 34 q10 -6 12 -14 l10 3 q-2 12 -12 20 Z"
                fill="#1f2937"
              />
              <circle cx="80" cy="20" r="11" fill="#1f2937" />
              <circle cx="83" cy="17" r="3.2" fill="#f8fafc" />
              <circle cx="84" cy="17" r="1.6" fill="#111827" />
              <path d="M89 22 l14 3 l-14 5 Z" fill="#f59e0b" />
              {/* 날개 */}
              <g transform={`rotate(${flapAngle} 44 36)`}>
                <path
                  d="M44 36 q14 -22 34 -20 q-6 20 -24 26 Z"
                  fill="#0f172a"
                />
                <path
                  d="M50 34 q10 -12 22 -12"
                  stroke="#334155"
                  strokeWidth="2"
                  fill="none"
                />
              </g>
            </svg>
          </div>
        )}

        {/* 탄도. 조준선에서 출발해 제멋대로 휜다 */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {/* 이미 도착한 탄이 지나온 길. 어디로 갔는지는 보여 드린다 */}
          {view.impacts.map((im) => (
            <polyline
              key={`t${im.id}`}
              points={im.path}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              opacity={Math.max(0, 0.6 - im.p * 0.6)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {view.pellets.map((p) => (
            <g key={p.id}>
              <polyline
                points={p.trail}
                fill="none"
                stroke="#0c4a6e"
                strokeWidth="3.4"
                strokeLinecap="round"
                opacity="0.28"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={p.trail}
                fill="none"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>

        {/* 비비탄 알 */}
        {view.pellets.map((p) => (
          <span
            key={p.id}
            className="pointer-events-none absolute h-[1.8%] w-[1.8%] rounded-full bg-amber-100 ring-1 ring-stone-900/30"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* 탄착 */}
        {view.impacts.map((im) => (
          <div key={im.id} className="pointer-events-none">
            {/* 튕겨 나가는 비비탄 */}
            <span
              className="absolute h-[1.8%] w-[1.8%] rounded-full bg-amber-200 ring-1 ring-stone-900/40"
              style={{
                left: `${im.x}%`,
                top: `${im.y}%`,
                transform: "translate(-50%, -50%)",
                opacity: 1 - im.p,
              }}
            />
            {im.kind === "hit" && (
              <span
                className="absolute text-sm font-bold text-stone-900/70"
                style={{
                  left: `${im.x + 3}%`,
                  top: `${im.y - 3 - im.p * 4}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: 1 - im.p,
                }}
              >
                톡
              </span>
            )}
            {/* 판정 표시 */}
            {im.id === lastImpact && (
              <span
                className={`absolute whitespace-nowrap rounded-md px-2 py-1 text-center text-xs font-bold leading-tight text-white shadow ${
                  im.kind === "hit" ? "bg-stone-900/85" : "bg-stone-900/55"
                }`}
                style={{
                  left: `${Math.min(78, Math.max(22, im.x))}%`,
                  top: `${Math.max(6, im.y - 13 - im.p * 6)}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: 1 - im.p * 0.7,
                }}
              >
                {im.kind === "hit" ? (
                  <>
                    명중 · {im.energy.toFixed(3)} J
                    <span className="block text-[10px] font-normal text-amber-300">
                      격추 임계 {DROP_J.toFixed(2)} J 미달
                    </span>
                  </>
                ) : (
                  <>
                    빗나감
                    <span className="block text-[10px] font-normal opacity-80">
                      조준점에서 {im.side}로 {im.drift.toFixed(1)} m
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
        ))}

        {/* 조준선 */}
        {phase === "play" && aim && (
          <div
            className="pointer-events-none absolute h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${aim.x}%`, top: `${aim.y}%` }}
          >
            <span className="absolute inset-0 rounded-full border-2 border-white/90" />
            <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/90" />
            <span className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-white/90" />
          </div>
        )}

        {/* 시작 전 덮개 */}
        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/60 text-white">
            <p className="text-center text-sm opacity-80">
              오리 {DUCKS_PER_ROUND}마리, 마리당 {SHELLS_PER_DUCK}발입니다.
              <br />
              {PASS_LINE}마리를 격추하시면 라운드 2로 갑니다.
            </p>
            <button
              onClick={start}
              className="rounded-lg bg-white px-10 py-3 text-lg font-bold text-stone-900 transition-opacity hover:opacity-80"
            >
              사냥 시작
            </button>
          </div>
        )}
      </div>

      {/* 이번 라운드 오리 현황 */}
      <div className="flex w-full max-w-xl items-center gap-2">
        <span className="text-xs opacity-50">라운드 1</span>
        <div className="flex flex-1 justify-end gap-1.5">
          {view.marks.map((m, i) => (
            <span
              key={i}
              title={`${i + 1}번째 오리`}
              className={`h-3 w-4 rounded-sm ${
                m === "downed"
                  ? "bg-red-500"
                  : m === "grazed"
                    ? "bg-amber-400"
                    : m === "missed"
                      ? "bg-foreground/25"
                      : m === "current"
                        ? "bg-foreground/60"
                        : "bg-foreground/10"
              }`}
            />
          ))}
        </div>
      </div>

      {phase === "play" && (
        <p className="text-center text-sm opacity-60">
          조준선은 정확합니다. 탄이 평균 {avgDrift.toFixed(1)}m씩 벗어나고
          있습니다.
        </p>
      )}

      {phase === "over" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div className="text-center">
            <p className="text-5xl">🐕</p>
            <p className="mt-2 text-2xl font-bold">게임 오버</p>
            <p className="mt-1 text-sm opacity-60">
              격추 {view.downed}마리. 통과 기준은 {PASS_LINE}마리였습니다. 개가
              웃고 있습니다.
            </p>
          </div>

          <dl className="w-full divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">발사</dt>
              <dd className="font-bold tabular-nums">{view.shots}발</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">명중</dt>
              <dd className="font-bold tabular-nums">{view.hits}발</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">명중률</dt>
              <dd className="font-bold tabular-nums">{accuracy.toFixed(1)}%</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">평균 탄착 편차</dt>
              <dd className="font-bold tabular-nums">
                {avgDrift.toFixed(2)} m
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">가장 많이 벗어난 한 발</dt>
              <dd className="font-bold tabular-nums">
                {drift.max.toFixed(2)} m
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">맞고도 날아간 오리</dt>
              <dd className="font-bold tabular-nums">{grazed}마리</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">가장 잘 맞은 한 발</dt>
              <dd className="font-bold tabular-nums">{maxJ.toFixed(3)} J</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">격추 판정 임계치</dt>
              <dd className="font-bold tabular-nums">{DROP_J.toFixed(2)} J</dd>
            </div>
          </dl>

          <p className="text-center text-sm opacity-60">
            {comment(view.shots, view.hits, avgDrift)}
          </p>

          <button
            onClick={start}
            className="rounded-lg border border-foreground/20 px-8 py-3 font-bold transition-opacity hover:opacity-70"
          >
            다시 열 마리
          </button>
        </div>
      )}

      <p className="max-w-xl text-center text-xs opacity-50">
        지급 탄약: 0.20g 비비탄, 초속 {MUZZLE_MIN}~{MUZZLE_MAX}m/s. 가벼워서
        측풍에 밀리고, 홉업이 과해서 뜨고, 회전이 걸려서 휩니다. 명중 판정은
        조준점이 아니라 탄이 실제로 도달한 지점으로 합니다. 발당 운동에너지{" "}
        {energyOf(MUZZLE_MIN).toFixed(3)}~{energyOf(MUZZLE_MAX).toFixed(3)} J,
        격추 판정식은 원본 그대로 1.00 J 이상에서 작동합니다.
      </p>
    </div>
  );
}
