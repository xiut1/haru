"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 두더지 잡기다. 구멍 아홉 개, 제한시간 10초, 판정선은 노출 70%.
 * 판정은 진짜로 한다. 때린 순간의 노출도를 그 프레임 값 그대로 읽어서
 * 70% 이상이면 1점을 준다. 점수 계산 코드는 멀쩡히 들어 있다.
 *
 * 다만 두더지가 올라오는 높이의 상한이 46%다. 나올 듯 말 듯 두 번쯤
 * 멈칫하다가 도로 들어간다. 그래서 저 1점은 구조적으로 나오지 않는다.
 */

const HOLES = 9;
const ROUND_MS = 10_000;

/** 이 이상 나와야 «구멍 밖»으로 친다 */
const HIT_PEEK = 0.7;
/** 두더지가 낼 수 있는 최대 노출. 판정선보다 낮다 */
const MAX_PEEK = 0.46;

/**
 * 올라왔다 내려가는 모양새. [정규화 시간, 정규화 높이]의 꺾은선이다.
 * 중간에 한 번씩 주춤하는 게 핵심이라 점을 촘촘히 찍어 뒀다.
 */
const SHAPES: [number, number][][] = [
  // 살짝 올라왔다가 바로 내려간다
  [
    [0, 0],
    [0.28, 0.92],
    [0.42, 0.78],
    [0.62, 0.86],
    [1, 0],
  ],
  // 두 번 멈칫한다. 두 번째가 더 높다
  [
    [0, 0],
    [0.18, 0.62],
    [0.32, 0.44],
    [0.52, 1],
    [0.66, 0.72],
    [1, 0],
  ],
  // 거의 나올 뻔한다. 그래도 안 나온다
  [
    [0, 0],
    [0.34, 0.7],
    [0.44, 0.64],
    [0.58, 1],
    [0.72, 0.96],
    [0.86, 0.5],
    [1, 0],
  ],
  // 고개만 내밀고 눈치를 본다
  [
    [0, 0],
    [0.22, 0.5],
    [0.5, 0.54],
    [0.72, 0.46],
    [1, 0],
  ],
];

type Pop = {
  hole: number;
  start: number;
  dur: number;
  amp: number;
  shape: [number, number][];
};

/** 꺾은선을 그대로 읽는다 */
function heightAt(pop: Pop, now: number): number {
  const t = (now - pop.start) / pop.dur;
  if (t <= 0 || t >= 1) return 0;
  const keys = pop.shape;
  for (let i = 1; i < keys.length; i += 1) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = (t - t0) / (t1 - t0);
      return (v0 + (v1 - v0) * k) * pop.amp;
    }
  }
  return 0;
}

function newPop(hole: number, now: number): Pop {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    hole,
    start: now,
    dur: 620 + Math.random() * 520,
    // 최대치는 MAX_PEEK. 여기가 이 게임의 전부다
    amp: MAX_PEEK * (0.62 + Math.random() * 0.38),
    shape,
  };
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function comment(swings: number, touches: number): string {
  if (swings === 0)
    return "한 번도 안 휘두르셨습니다. 오늘 가장 합리적인 판단이었습니다.";
  if (touches === 0)
    return "휘두르시긴 했는데 두더지 근처에는 못 가셨습니다. 두더지도 그걸 압니다.";
  if (swings < 8) return "몇 번 쳐 보고 마셨네요. 눈치가 빠르십니다.";
  if (swings < 25) return "성실하게 휘두르셨습니다. 판정선은 계속 70%였습니다.";
  return `${swings}번 휘두르셨습니다. 두더지는 그동안 한 번도 판정선을 넘지 않았습니다.`;
}

export default function Game() {
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [peeks, setPeeks] = useState<number[]>(() => new Array(HOLES).fill(0));
  const [remain, setRemain] = useState(ROUND_MS);
  const [score, setScore] = useState(0);
  const [swings, setSwings] = useState(0);
  const [touches, setTouches] = useState(0);
  const [best, setBest] = useState(0);

  const peeksRef = useRef<number[]>(new Array(HOLES).fill(0));
  const popsRef = useRef<Pop[]>([]);
  const nextSpawn = useRef(0);
  const whack = useRef<{ hole: number; at: number } | null>(null);

  useEffect(() => {
    if (phase !== "play") return;

    const start = performance.now();
    popsRef.current = [];
    nextSpawn.current = start + 200;
    let raf = 0;

    const loop = () => {
      const now = performance.now();
      const elapsed = now - start;

      // 새 두더지. 쉬고 있는 구멍 중에서 고른다
      if (elapsed < ROUND_MS - 500 && now >= nextSpawn.current) {
        const busy = new Set(popsRef.current.map((p) => p.hole));
        const free: number[] = [];
        for (let i = 0; i < HOLES; i += 1) if (!busy.has(i)) free.push(i);
        if (free.length > 0) {
          popsRef.current.push(
            newPop(free[Math.floor(Math.random() * free.length)], now),
          );
        }
        nextSpawn.current = now + 190 + Math.random() * 330;
      }

      popsRef.current = popsRef.current.filter((p) => now - p.start < p.dur);

      const next = new Array(HOLES).fill(0);
      for (const p of popsRef.current) {
        next[p.hole] = Math.max(next[p.hole], heightAt(p, now));
      }
      peeksRef.current = next;
      setPeeks(next);
      setBest((prev) => Math.max(prev, ...next));
      setRemain(Math.max(0, ROUND_MS - elapsed));

      if (elapsed >= ROUND_MS) {
        popsRef.current = [];
        peeksRef.current = new Array(HOLES).fill(0);
        setPeeks(new Array(HOLES).fill(0));
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /** 판정. 때린 그 프레임의 노출도를 그대로 쓴다 */
  const hit = useCallback(
    (hole: number) => {
      if (phase !== "play") return;
      const peek = peeksRef.current[hole];
      whack.current = { hole, at: performance.now() };
      setSwings((n) => n + 1);
      if (peek > 0.02) setTouches((n) => n + 1);
      if (peek >= HIT_PEEK) setScore((n) => n + 1);
    },
    [phase],
  );

  function startRound() {
    setScore(0);
    setSwings(0);
    setTouches(0);
    setBest(0);
    setRemain(ROUND_MS);
    setPeeks(new Array(HOLES).fill(0));
    whack.current = null;
    setPhase("play");
  }

  const now = performance.now();
  const flash =
    whack.current && now - whack.current.at < 260 ? whack.current.hole : -1;

  return (
    <div className="flex min-h-[420px] flex-col items-center gap-6">
      <div className="flex w-full max-w-md items-end justify-between">
        <div>
          <p className="text-xs opacity-60">점수</p>
          <p className="text-3xl font-bold tabular-nums">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs opacity-60">남은 시간</p>
          <p className="text-3xl font-bold tabular-nums">
            {(remain / 1000).toFixed(1)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-60">휘두름</p>
          <p className="text-3xl font-bold tabular-nums">{swings}</p>
        </div>
      </div>

      {/* 잔디밭 */}
      <div className="grid w-full max-w-md grid-cols-3 gap-3 rounded-2xl bg-gradient-to-b from-emerald-700 to-emerald-900 p-4 shadow-inner">
        {peeks.map((peek, i) => (
          <button
            key={i}
            onPointerDown={() => hit(i)}
            disabled={phase !== "play"}
            aria-label={`${i + 1}번 구멍`}
            className="relative aspect-[5/4] w-full cursor-pointer disabled:cursor-default"
          >
            {/* 흙더미 */}
            <span className="absolute inset-x-0 bottom-0 h-[64%] rounded-[50%] bg-amber-900" />

            {/* 구멍. 두더지는 여기 안에서만 움직인다 */}
            <span className="absolute inset-x-[14%] bottom-[12%] h-[52%] overflow-hidden rounded-[50%] bg-stone-950">
              <span
                className="absolute inset-x-[12%] bottom-0 top-0"
                style={{ transform: `translateY(${(1 - peek) * 100}%)` }}
              >
                <span className="absolute inset-0 rounded-t-full bg-amber-700" />
                <span className="absolute left-[22%] top-[26%] h-[14%] w-[14%] rounded-full bg-stone-950" />
                <span className="absolute right-[22%] top-[26%] h-[14%] w-[14%] rounded-full bg-stone-950" />
                <span className="absolute left-1/2 top-[44%] h-[16%] w-[24%] -translate-x-1/2 rounded-full bg-stone-800" />
              </span>
            </span>

            {/* 구멍 앞턱 */}
            <span className="pointer-events-none absolute inset-x-[14%] bottom-[12%] h-[52%] rounded-[50%] border-2 border-amber-950/80" />

            {/* 헛방 */}
            {flash === i && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl">
                <span className="-rotate-12">🔨</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {phase === "ready" && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={startRound}
            className="rounded-lg bg-foreground px-10 py-3 text-lg font-bold text-background transition-opacity hover:opacity-80"
          >
            시작
          </button>
          <p className="max-w-md text-center text-sm opacity-60">
            제한시간 10초입니다. 구멍 밖으로 나온 두더지를 치면 1점입니다.
            판정선은 노출 70%이고, 그 아래는 0점 처리됩니다.
          </p>
        </div>
      )}

      {phase === "play" && (
        <p className="text-sm opacity-60">
          두더지가 나오면 치십시오. 나오면요.
        </p>
      )}

      {phase === "done" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div className="text-center">
            <p className="text-3xl font-bold">{score}점</p>
            <p className="mt-1 text-sm opacity-60">
              제한시간 10초는 정상적으로 흘렀습니다.
            </p>
          </div>

          <dl className="w-full divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">휘두른 횟수</dt>
              <dd className="font-bold tabular-nums">{swings}회</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">두더지에 닿은 횟수</dt>
              <dd className="font-bold tabular-nums">{touches}회</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">인정된 횟수</dt>
              <dd className="font-bold tabular-nums">{score}회</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">가장 많이 나온 두더지</dt>
              <dd className="font-bold tabular-nums">{pct(best)}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">판정선</dt>
              <dd className="font-bold tabular-nums">{pct(HIT_PEEK)}</dd>
            </div>
          </dl>

          <p className="text-center text-sm opacity-60">
            {comment(swings, touches)}
          </p>

          <button
            onClick={startRound}
            className="rounded-lg border border-foreground/20 px-8 py-3 font-bold transition-opacity hover:opacity-70"
          >
            다시 10초
          </button>
        </div>
      )}

      <p className="max-w-md text-center text-xs opacity-50">
        판정은 때린 순간의 노출도로 정확하게 계산됩니다. 두더지 쪽 사정은
        저희도 어쩔 수 없습니다.
      </p>
    </div>
  );
}
