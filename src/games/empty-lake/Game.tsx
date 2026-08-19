"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  beginCharge,
  createSim,
  H,
  hookSet,
  MAX_DIST,
  powerToDist,
  releaseCast,
  STRIKE_DIP,
  step,
  W,
  type Outcome,
  type Phase,
  type Sim,
} from "./engine";
import { draw } from "./render";

const BAITS = [
  { name: "지렁이", note: "붕어·잉어에 특히 잘 듣습니다." },
  { name: "떡밥", note: "집어 효과가 좋아 물고기를 불러 모읍니다." },
  { name: "스푼 루어", note: "배스·쏘가리 같은 육식성 어종용입니다." },
];

/** 오늘의 호수 상태. 계측값은 전부 진짜다 */
const CONDITION = {
  depth: "3.4 m",
  temp: "21.6 ℃",
  clarity: "양호",
  wind: "북서 1.2 m/s",
};

type Entry = {
  n: number;
  dist: number;
  peakDip: number;
  text: string;
};

/** 마지막 글자의 받침. 0이면 없고 8이면 ㄹ이다 */
function jong(word: string): number {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return 0;
  return c % 28;
}

/** 「~로」 / 「~으로」 */
function ro(word: string): string {
  const j = jong(word);
  return `${word}${j === 0 || j === 8 ? "로" : "으로"}`;
}

/** 「~였습니다」 / 「~이었습니다」 */
function was(word: string): string {
  return `${word}${jong(word) === 0 ? "였습니다" : "이었습니다"}`;
}

function resultText(out: Outcome): string {
  const cause = out.cause || "잔물결";
  if (out.dip < 0.18) return "빈 바늘이 올라왔습니다. 미끼도 그대로입니다.";
  if (out.dip < 0.4) return `${was(cause)}. 챔질은 정확했습니다.`;
  return `${cause}입니다. 예신처럼 보이셨겠지만 아닙니다.`;
}

function verdict(casts: number, bestDip: number): string {
  if (casts === 0) return "한 번도 던지지 않으셨습니다. 결과는 던진 경우와 같습니다.";
  if (casts >= 15) return `${casts}번 던지셨습니다. 팔이 좋으신 편입니다.`;
  if (bestDip >= 0.55)
    return "최고 침하율이 꽤 나왔습니다. 챔질 기준은 100%라서 상관은 없습니다.";
  return "장비 이상은 발견되지 않았습니다.";
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(createSim());

  // 매 프레임 바뀌는 수치는 DOM에 직접 쓴다. 리렌더로 돌리기엔 아깝다
  const dipBarRef = useRef<HTMLDivElement>(null);
  const dipTextRef = useRef<HTMLSpanElement>(null);
  const powerBarRef = useRef<HTMLDivElement>(null);
  const distTextRef = useRef<HTMLSpanElement>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [cause, setCause] = useState("");
  const [bait, setBait] = useState(0);
  const [log, setLog] = useState<Entry[]>([]);
  const [casts, setCasts] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [totalDist, setTotalDist] = useState(0);
  const [bestDip, setBestDip] = useState(0);
  const [packed, setPacked] = useState(false);

  const cast = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase === "ready") beginCharge(sim);
  }, []);

  const release = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== "charge") return;
    releaseCast(sim);
    setCasts((n) => n + 1);
    setTotalDist((d) => d + sim.dist);
  }, []);

  const strike = useCallback(() => {
    const sim = simRef.current;
    const out = hookSet(sim);
    if (!out) return;
    setStrikes((n) => n + 1);
    setBestDip((d) => Math.max(d, out.peakDip));
    setLog((prev) =>
      [
        {
          n: prev.length + 1,
          dist: out.dist,
          peakDip: out.peakDip,
          text: resultText(out),
        },
        ...prev,
      ].slice(0, 5),
    );
  }, []);

  /** 상황에 맞는 동작 하나로 묶는다. 캔버스 클릭과 스페이스가 같게 굴러야 한다 */
  const primaryDown = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase === "ready") cast();
    else if (sim.phase === "wait") strike();
  }, [cast, strike]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (e.repeat) return;
      primaryDown();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      release();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [primaryDown, release]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let prevPhase: Phase = "ready";
    let prevCause = "";

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const sim = simRef.current;
      step(sim, dt);
      draw(ctx, sim);

      const dip = sim.phase === "wait" ? sim.dip : 0;
      if (dipBarRef.current) dipBarRef.current.style.width = `${dip * 100}%`;
      if (dipTextRef.current) dipTextRef.current.textContent = `${Math.round(dip * 100)}%`;
      if (powerBarRef.current)
        powerBarRef.current.style.width = `${(sim.phase === "charge" ? sim.power : 0) * 100}%`;
      if (distTextRef.current)
        distTextRef.current.textContent =
          sim.phase === "charge"
            ? `${powerToDist(sim.power).toFixed(1)} m`
            : sim.dist > 0
              ? `${sim.dist.toFixed(1)} m`
              : "— m";

      if (sim.phase !== prevPhase) {
        prevPhase = sim.phase;
        setPhase(sim.phase);
      }
      if (sim.cause !== prevCause) {
        prevCause = sim.cause;
        setCause(sim.cause);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (sim.phase !== "ready" && sim.phase !== "charge") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    sim.aim = Math.max(-1, Math.min(1, (x - 0.5) * 2));
  };

  const hint =
    phase === "ready"
      ? "누르고 있으면 파워가 차고, 손을 떼면 던져집니다."
      : phase === "charge"
        ? "지금 떼면 이 거리로 날아갑니다."
        : phase === "wait"
          ? cause
            ? `${ro(cause)} 찌가 흔들리고 있습니다.`
            : "찌를 보고 계십시오. 완전히 잠기면 챔질하십시오."
          : phase === "cast"
            ? "던지는 중입니다."
            : "감아 들이는 중입니다.";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.preventDefault();
            aim(e);
            primaryDown();
          }}
          onPointerMove={aim}
          onPointerUp={release}
          onPointerLeave={release}
          className="w-full cursor-crosshair rounded-xl border border-foreground/20 shadow-2xl"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between font-mono text-[11px] text-white">
          <div className="rounded-lg bg-black/45 px-3 py-2 leading-relaxed backdrop-blur-sm">
            <div className="opacity-60">비거리</div>
            <div className="text-base font-bold tabular-nums">
              <span ref={distTextRef}>— m</span>
            </div>
            <div className="mt-1 opacity-60">미끼 · {BAITS[bait].name}</div>
          </div>

          {/* 어군 탐지기. 계속 돌고 있습니다 */}
          <div className="rounded-lg bg-black/45 px-3 py-2 leading-relaxed backdrop-blur-sm">
            <div className="opacity-60">어군 탐지기</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-emerald-400/50 bg-emerald-400/10">
                <div className="absolute inset-[30%] rounded-full border border-emerald-400/30" />
                <div
                  className="absolute inset-0 animate-spin rounded-full"
                  style={{
                    animationDuration: "3.2s",
                    background:
                      "conic-gradient(from 0deg, rgba(52,211,153,0.55), rgba(52,211,153,0) 55%)",
                  }}
                />
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-emerald-300">0</div>
                <div className="opacity-60">마리</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3">
          <div className="rounded-lg bg-black/50 px-3 py-2 text-center text-xs text-white backdrop-blur-sm">
            {hint}
          </div>
        </div>
      </div>

      {/* 침하율. 챔질 기준은 완전 침하(100%)입니다 */}
      <div className="w-full max-w-[360px]">
        <div className="flex items-baseline justify-between text-xs">
          <span className="opacity-60">찌 침하율</span>
          <span className="font-mono tabular-nums opacity-80">
            <span ref={dipTextRef}>0%</span>
            <span className="opacity-50"> / 챔질 기준 {STRIKE_DIP * 100}%</span>
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full border border-foreground/20 bg-foreground/5">
          <div
            ref={dipBarRef}
            className="h-full rounded-full bg-sky-500/80 transition-[width] duration-75"
            style={{ width: "0%" }}
          />
        </div>
      </div>

      {/* 캐스팅 파워 */}
      <div className="w-full max-w-[360px]">
        <div className="flex items-baseline justify-between text-xs">
          <span className="opacity-60">캐스팅 파워</span>
          <span className="font-mono tabular-nums opacity-50">최대 {MAX_DIST} m</span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full border border-foreground/20 bg-foreground/5">
          <div
            ref={powerBarRef}
            className="h-full rounded-full bg-amber-500/80"
            style={{ width: "0%" }}
          />
        </div>
      </div>

      {/* 모바일용. 키보드·캔버스 클릭과 완전히 동일합니다 */}
      <div className="flex w-full max-w-[360px] gap-2 sm:hidden">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            cast();
          }}
          onPointerUp={release}
          onPointerLeave={release}
          disabled={phase !== "ready" && phase !== "charge"}
          className="flex-1 rounded-lg border border-foreground/20 py-4 text-sm font-bold active:bg-foreground/10 disabled:opacity-40"
        >
          던지기 (길게)
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            strike();
          }}
          disabled={phase !== "wait"}
          className="flex-1 rounded-lg border border-foreground/20 py-4 text-sm font-bold active:bg-foreground/10 disabled:opacity-40"
        >
          챔질
        </button>
      </div>

      {/* 미끼 */}
      <div className="w-full max-w-[360px]">
        <p className="mb-2 text-xs opacity-60">미끼</p>
        <div className="flex gap-2">
          {BAITS.map((b, i) => (
            <button
              key={b.name}
              onClick={() => setBait(i)}
              disabled={phase !== "ready"}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs transition disabled:opacity-40 ${
                i === bait
                  ? "border-foreground/60 bg-foreground/10 font-bold"
                  : "border-foreground/20 hover:bg-foreground/5"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-50">{BAITS[bait].note}</p>
      </div>

      {/* 조황 */}
      <dl className="w-full max-w-[360px] divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
        {[
          ["수심", CONDITION.depth],
          ["수온", CONDITION.temp],
          ["탁도", CONDITION.clarity],
          ["바람", CONDITION.wind],
          ["서식 어종", "없음"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-2">
            <dt className="opacity-60">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {log.length > 0 && (
        <div className="w-full max-w-[360px]">
          <p className="mb-2 text-xs opacity-60">챔질 기록</p>
          <ul className="space-y-1 text-sm">
            {log.map((e) => (
              <li key={e.n} className="flex flex-col rounded-lg bg-foreground/5 px-3 py-2">
                <span className="font-mono text-xs opacity-60">
                  {e.n}회차 · {e.dist.toFixed(1)} m · 최대 침하 {Math.round(e.peakDip * 100)}%
                </span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="w-full max-w-[360px] border-t border-foreground/15 pt-4">
        {packed ? (
          <div className="space-y-3">
            <p className="font-bold">오늘의 조과</p>
            <dl className="divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
              {[
                ["캐스팅", `${casts}회`],
                ["총 비거리", `${totalDist.toFixed(1)} m`],
                ["챔질", `${strikes}회`],
                ["최대 침하율", `${Math.round(bestDip * 100)}%`],
                ["챔질 기준", `${STRIKE_DIP * 100}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2">
                  <dt className="opacity-60">{k}</dt>
                  <dd className="font-mono tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2">
                <dt className="opacity-60">잡은 물고기</dt>
                <dd className="font-mono font-bold tabular-nums">0마리</dd>
              </div>
            </dl>
            <p className="text-sm opacity-70">{verdict(casts, bestDip)}</p>
            <button
              onClick={() => setPacked(false)}
              className="rounded-full border border-foreground/20 px-6 py-2 text-sm hover:bg-foreground/10"
            >
              다시 펴기
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm opacity-60">
              캐스팅 {casts}회 · 챔질 {strikes}회 · 조과 0마리
            </p>
            <button
              onClick={() => setPacked(true)}
              className="shrink-0 rounded-full border border-foreground/20 px-5 py-2 text-sm hover:bg-foreground/10"
            >
              낚시 접기
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[360px] border-t border-foreground/15 pt-4 text-sm opacity-60">
        <p className="mb-2 font-bold opacity-80">조작</p>
        <ul className="space-y-1">
          <li>
            <kbd className="font-mono">Space</kbd> 길게 눌러 파워, 떼면 캐스팅
          </li>
          <li>수면을 클릭하면 그 방향으로 던집니다</li>
          <li>
            찌가 완전히 잠기면 <kbd className="font-mono">Space</kbd>로 챔질
          </li>
        </ul>
        <p className="mt-3 text-xs opacity-70">
          이 호수의 어류 서식은 확인되지 않았습니다. 장비와 채비는 정상이며, 찌가
          흔들리는 것은 바람과 잔물결에 의한 것입니다.
        </p>
      </div>
    </div>
  );
}
