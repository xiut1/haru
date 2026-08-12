"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * 버튼이다. 규칙은 하나뿐이고, 그 하나는 정확히 지킨다.
 * 한 번 누르면 끝이다. 기록이 localStorage에 남으므로 새로고침해도,
 * 창을 닫았다 며칠 뒤에 다시 와도 버튼은 계속 눌린 상태다.
 *
 * 누르면 무슨 일이 일어나느냐 하면, 아무 일도 일어나지 않는다.
 * 대신 누르기까지 망설인 시간을 0.1초 단위로 재서 영구히 남겨 둔다.
 * 이 게임에서 성실하게 동작하는 부분은 그것뿐이고, 실제로 성실하다.
 */

const KEY = "haru:press-once";

type Press = {
  /** 누른 시각 (epoch ms) */
  pressedAt: number;
  /** 페이지를 연 뒤 누르기까지 걸린 시간 (ms) */
  hesitatedMs: number;
  /** 누르기 전에 버튼 위로 마우스가 들어온 횟수 */
  approaches: number;
};

/**
 * 저장소는 브라우저에만 있다. 정적 생성된 HTML에는 기록이 없으므로
 * 서버 쪽 스냅샷은 «아직 모름»으로 두고, 하이드레이션이 끝난 뒤에
 * 진짜 값으로 한 번 다시 그린다.
 */
const PENDING = Symbol("pending");
type Snapshot = typeof PENDING | string | null;

let cached: Snapshot = PENDING;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function readSnapshot(): Snapshot {
  if (cached === PENDING) {
    try {
      cached = localStorage.getItem(KEY);
    } catch {
      // 저장소를 막아 두셨다면 이번 방문 동안만 기억하겠습니다.
      cached = null;
    }
  }
  return cached;
}

function serverSnapshot(): Snapshot {
  return PENDING;
}

/** 기록한다. 되돌리는 함수는 만들지 않는다. */
function remember(press: Press) {
  const raw = JSON.stringify(press);
  cached = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // 위와 같습니다. 어차피 아무 일도 일어나지 않습니다.
  }
  for (const fn of listeners) fn();
}

/** 형태가 이상하면 없는 셈 친다. */
function parse(raw: string | null): Press | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Press>;
    if (typeof value?.pressedAt !== "number") return null;
    return {
      pressedAt: value.pressedAt,
      hesitatedMs: typeof value.hesitatedMs === "number" ? value.hesitatedMs : 0,
      approaches: typeof value.approaches === "number" ? value.approaches : 0,
    };
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 지난 시간을 사람이 읽는 단위로. 0.1초 단위는 망설임에만 쓴다. */
function elapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (days || hours) parts.push(`${hours}시간`);
  if (days || hours || mins) parts.push(`${mins}분`);
  parts.push(`${secs}초`);
  return parts.join(" ");
}

function hesitationComment(ms: number): string {
  if (ms < 1500) return "1.5초도 안 걸리셨습니다. 다행히 고민할 값어치도 없는 버튼이었습니다.";
  if (ms < 10_000) return "적당히 재보고 누르셨네요. 결과는 재지 않고 누른 것과 같습니다.";
  if (ms < 60_000) return "꽤 재보셨습니다. 그 시간은 이제 저 위에 영구히 남습니다.";
  if (ms < 300_000) return "1분 넘게 고민하셨습니다. 버튼은 그동안 아무것도 준비하지 않았습니다.";
  return "5분 넘게 망설이셨습니다. 그 판단은 옳았습니다. 다만 결국 누르셨습니다.";
}

/** 마우스가 버튼 위에 들어온 횟수. 실제로 누른 그 한 번도 포함돼 있다. */
function approachComment(n: number): string {
  if (n <= 1) return "한 번에 가셨습니다. 손이 흔들리지 않더군요.";
  if (n <= 3) return `버튼 위로 ${n}번 손이 갔습니다. 평범한 편입니다.`;
  if (n <= 9) return `버튼 위로 ${n}번 손이 갔습니다. 세고 있었습니다.`;
  return `버튼 위로 ${n}번 손이 갔습니다. 그 횟수만큼 마음이 바뀌셨겠지요.`;
}

export default function Game() {
  const raw = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
  const ready = raw !== PENDING;
  const press = useMemo(() => (raw === PENDING ? null : parse(raw)), [raw]);

  const [approaches, setApproaches] = useState(0);
  const [hesitating, setHesitating] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pressedHere, setPressedHere] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const openedAt = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 아직 안 누른 동안은 0.1초마다 망설인 시간을 갱신한다.
  useEffect(() => {
    if (press) return;
    const start = Date.now();
    openedAt.current = start;
    const id = setInterval(() => setHesitating(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [press]);

  // 누른 뒤에는 그 시각으로부터 얼마나 지났는지를 센다. 영원히 센다.
  useEffect(() => {
    if (!press) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [press]);

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  function doPress() {
    if (press) return;
    const at = Date.now();
    setPressedHere(true);
    setNow(at);
    remember({
      pressedAt: at,
      hesitatedMs: at - (openedAt.current || at),
      approaches,
    });
    // 누르자마자 결과를 알려드리면 성의가 없어 보여서 0.7초 기다립니다.
    revealTimer.current = setTimeout(() => setRevealed(true), 700);
  }

  if (!ready) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <p className="text-sm opacity-50">기록을 확인하는 중입니다…</p>
      </div>
    );
  }

  if (!press) {
    return (
      <div className="flex min-h-[420px] flex-col items-center gap-8">
        <p className="max-w-md text-center text-sm opacity-70">
          이 버튼은 한 번만 누를 수 있습니다. 누르면 아무 일도 일어나지 않고, 그
          뒤로는 영원히 눌리지 않습니다. 확인 창은 없습니다. 있으면 두 번 누르시게
          되니까요.
        </p>

        <button
          onClick={doPress}
          onMouseEnter={() => setApproaches((n) => n + 1)}
          className="h-44 w-44 rounded-full bg-red-500 text-xl font-bold text-white shadow-[0_10px_0_0_#991b1b] transition-all duration-75 hover:bg-red-400 active:translate-y-[8px] active:shadow-[0_2px_0_0_#991b1b] sm:h-52 sm:w-52 sm:text-2xl"
        >
          누르기
        </button>

        <dl className="flex gap-8 text-center text-sm">
          <div>
            <dt className="opacity-60">망설인 시간</dt>
            <dd className="text-xl font-bold tabular-nums">
              {(hesitating / 1000).toFixed(1)}초
            </dd>
          </div>
          <div>
            <dt className="opacity-60">남은 기회</dt>
            <dd className="text-xl font-bold tabular-nums">1회</dd>
          </div>
        </dl>

        <p className="max-w-md text-center text-xs opacity-50">
          망설인 시간은 누르는 순간 기록에 남습니다. 지금도 재고 있습니다.
        </p>
      </div>
    );
  }

  const showResult = revealed || !pressedHere;

  return (
    <div className="flex min-h-[420px] flex-col items-center gap-8">
      <p className="max-w-md text-center text-sm opacity-70">
        이 버튼은 이미 누르셨습니다.
      </p>

      <button
        disabled
        className="h-44 w-44 cursor-not-allowed rounded-full bg-foreground/10 text-xl font-bold text-foreground/40 sm:h-52 sm:w-52 sm:text-2xl"
      >
        눌림
      </button>

      <div
        className={`min-h-[56px] text-center transition-opacity duration-700 ${
          showResult ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-2xl font-bold">아무 일도 일어나지 않았습니다.</p>
        <p className="mt-1 text-sm opacity-60">
          {hesitationComment(press.hesitatedMs)}
        </p>
      </div>

      <dl className="w-full max-w-sm divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="opacity-60">누른 시각</dt>
          <dd className="font-bold tabular-nums">{stamp(press.pressedAt)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="opacity-60">망설인 시간</dt>
          <dd className="font-bold tabular-nums">
            {(press.hesitatedMs / 1000).toFixed(1)}초
          </dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="opacity-60">그 뒤로</dt>
          <dd className="font-bold tabular-nums">{elapsed(now - press.pressedAt)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="opacity-60">남은 기회</dt>
          <dd className="font-bold tabular-nums">0회</dd>
        </div>
      </dl>

      <p className="max-w-md text-center text-sm opacity-60">
        {approachComment(press.approaches)}
      </p>

      <p className="max-w-md text-center text-xs opacity-50">
        초기화 버튼은 없습니다. 그게 이 게임의 전부입니다. 정 다시 누르고 싶으시면
        브라우저 저장소에서 <code className="font-mono">{KEY}</code> 항목을 직접
        지우십시오. 말리지는 않겠습니다. 지우셔도 아무 일은 일어나지 않습니다.
      </p>
    </div>
  );
}
