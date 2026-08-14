"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * 목표 시간이 3~10초 중에 하나 뜬다. 시작을 누르고, 그만큼 지났다 싶을 때
 * 다시 누른다. 재는 쪽은 performance.now()로 정직하게 재고 밀리초까지 보여준다.
 * 통계도 진짜 통계다.
 *
 * 빠진 것은 보상이다. 0ms로 맞혀도 축하 화면도, 승리도, 다음 단계도 없다.
 * 잘하시면 「올~ ㅋㅋ」이라고 해 드리는 것까지가 이 게임의 전부다.
 */

const MIN_TARGET = 3;
const MAX_TARGET = 10;

type Try = {
  /** 목표(초) */
  target: number;
  /** 실제로 누른 시각까지 걸린 시간(ms) */
  elapsedMs: number;
};

type Reaction = { tag: string; note: string };

/** 잘할수록 짧게 반응해 준다. 그 이상은 없다. */
function react(errorMs: number, target: number): Reaction {
  const e = Math.abs(errorMs);
  if (e === 0)
    return {
      tag: "0ms. 올~ ㅋㅋ",
      note: "이건 진짜 가끔 나옵니다. 그래도 축하는 없습니다. 다음 목표는 준비돼 있습니다.",
    };
  if (e < 20)
    return {
      tag: "올~ ㅋㅋ",
      note: "0.0몇 초 차이입니다. 진짜로 맞히셨네요. 드릴 건 없습니다.",
    };
  if (e < 50)
    return {
      tag: "올~ ㅋㅋ",
      note: "생각보다 잘 세시네요. 그래도 아무 일도 일어나지 않습니다.",
    };
  if (e < 120)
    return {
      tag: "오 좀 하시는데요 ㅋㅋ",
      note: "자랑하실 만합니다. 자랑하실 곳은 없습니다.",
    };
  if (e < 300)
    return { tag: "뭐, 나쁘진 않네요.", note: "이 정도는 다들 하십니다." };
  if (e < 700)
    return { tag: "음.", note: "특별히 드릴 말씀이 없습니다." };
  if (e < 1500)
    return {
      tag: "한참 빗나갔는데요.",
      note: "목표는 화면 위에 계속 적혀 있었습니다.",
    };
  return {
    tag: "혹시 다른 걸 세고 계셨나요?",
    note: `이번 목표는 ${target}초였습니다. 초 단위로요.`,
  };
}

/** 통계에 붙이는 한 줄. 잘하실수록 시큰둥해진다. */
function summary(tries: Try[]): string {
  if (tries.length < 3) return "표본이 적습니다. 더 하셔도 달라지는 건 없습니다.";
  const avg =
    tries.reduce((sum, t) => sum + Math.abs(t.elapsedMs - t.target * 1000), 0) /
    tries.length;
  if (avg < 80) return "평균 오차가 0.08초 미만입니다. 그래서요?";
  if (avg < 200) return "꾸준히 잘 맞히십니다. 꾸준히 아무 일도 없습니다.";
  if (avg < 600) return "평범한 사람의 기록입니다. 안심하셔도 됩니다.";
  return "시간 감각이 독특하십니다. 그건 그것대로 괜찮습니다.";
}

function fmt(ms: number): string {
  return (ms / 1000).toFixed(3);
}

/** 이번 목표. 직전 목표와는 다른 값으로 준다. */
function pickTarget(prev: number): number {
  const pool: number[] = [];
  for (let n = MIN_TARGET; n <= MAX_TARGET; n += 1) if (n !== prev) pool.push(n);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Game() {
  const [target, setTarget] = useState(0);
  const [phase, setPhase] = useState<"ready" | "running" | "result">("ready");
  const [last, setLast] = useState<Try | null>(null);
  const [tries, setTries] = useState<Try[]>([]);

  const startedAt = useRef(0);

  // 목표는 브라우저에서 뽑는다. 렌더 중에 뽑으면 정적 HTML과 어긋난다.
  useEffect(() => {
    setTarget(pickTarget(0));
  }, []);

  const press = useCallback(() => {
    if (target === 0) return;

    if (phase === "running") {
      const elapsedMs = performance.now() - startedAt.current;
      const done: Try = { target, elapsedMs };
      setLast(done);
      setTries((prev) => [...prev, done]);
      setPhase("result");
      return;
    }

    // 결과를 보다가 누르면 새 목표만 뽑고 멈춘다. 목표를 읽을 시간은 드려야
    // 게임이 성립한다. 시계는 그다음 누르실 때 돈다.
    if (phase === "result") {
      setTarget((prev) => pickTarget(prev));
      setLast(null);
      setPhase("ready");
      return;
    }

    startedAt.current = performance.now();
    setPhase("running");
  }, [phase, target]);

  // 스페이스바로도 된다. 버튼이 포커스를 먹고 두 번 눌리는 일은 막는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      press();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const stats = useMemo(() => {
    if (tries.length === 0) return null;
    const errors = tries.map((t) => Math.abs(t.elapsedMs - t.target * 1000));
    return {
      count: tries.length,
      best: Math.min(...errors),
      avg: errors.reduce((a, b) => a + b, 0) / tries.length,
      close: errors.filter((e) => e < 50).length,
    };
  }, [tries]);

  const errorMs = last ? last.elapsedMs - last.target * 1000 : 0;
  const reaction = last ? react(Math.round(errorMs), last.target) : null;
  const early = errorMs < 0;

  return (
    <div className="flex min-h-[420px] flex-col items-center gap-8">
      {/* 목표. 재는 동안에도 계속 보여 드린다. 잊어버리시면 그건 그것대로 곤란해서 */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm opacity-60">이번 목표</p>
        <p className="text-5xl font-bold tabular-nums">
          {target === 0 ? "—" : `${target}초`}
        </p>
      </div>

      <button
        onClick={press}
        disabled={target === 0}
        className={`h-40 w-40 rounded-full text-xl font-bold transition-transform active:scale-95 disabled:opacity-40 sm:h-48 sm:w-48 sm:text-2xl ${
          phase === "running"
            ? "bg-foreground text-background"
            : "border-2 border-foreground/20 bg-foreground/5 hover:bg-foreground/10"
        }`}
      >
        {phase === "running"
          ? "여기서 멈춤"
          : phase === "result"
            ? "새 목표"
            : "시작"}
      </button>

      <div className="flex min-h-[132px] w-full max-w-md flex-col items-center">
        {phase === "running" && (
          <p className="text-sm opacity-60">
            재는 중입니다. 시간은 알려드리지 않습니다.
          </p>
        )}

        {phase === "ready" && (
          <p className="text-center text-sm opacity-60">
            누르는 순간부터 잽니다. {target === 0 ? "" : `${target}초 뒤에 `}다시
            누르시면 됩니다. 스페이스바로도 됩니다.
          </p>
        )}

        {phase === "result" && last && reaction && (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="text-2xl font-bold">{reaction.tag}</p>

            <p className="font-mono text-sm tabular-nums opacity-70">
              {last.target}.000초 목표 · {fmt(last.elapsedMs)}초 기록
            </p>

            <p className="text-center">
              <span className="text-3xl font-bold tabular-nums">
                {early ? "−" : "+"}
                {fmt(Math.abs(errorMs))}초
              </span>
              <span className="ml-2 text-sm opacity-60">
                {Math.round(Math.abs(errorMs)) === 0
                  ? "정확합니다"
                  : early
                    ? "일찍 누르셨습니다"
                    : "늦게 누르셨습니다"}
              </span>
            </p>

            <p className="text-center text-sm opacity-60">{reaction.note}</p>
          </div>
        )}
      </div>

      {stats && (
        <div className="w-full max-w-sm">
          <dl className="divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">시도</dt>
              <dd className="font-bold tabular-nums">{stats.count}회</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">가장 작은 오차</dt>
              <dd className="font-bold tabular-nums">{fmt(stats.best)}초</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">평균 오차</dt>
              <dd className="font-bold tabular-nums">{fmt(stats.avg)}초</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">0.05초 이내</dt>
              <dd className="font-bold tabular-nums">{stats.close}회</dd>
            </div>
          </dl>
          <p className="mt-3 text-center text-xs opacity-50">{summary(tries)}</p>
        </div>
      )}

      <p className="max-w-md text-center text-xs opacity-50">
        기록은 이 페이지를 닫으면 사라집니다. 순위표도, 저장도 없습니다. 시계를
        보고 세셔도 됩니다. 저희는 알 방법이 없고, 알아도 아무 일도 일어나지
        않습니다.
      </p>
    </div>
  );
}
