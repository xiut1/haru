"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BIRD_H,
  createSim,
  GAP,
  H,
  MIN_CLIP,
  step,
  W,
  type HitInfo,
  type Sim,
} from "./engine";
import { draw } from "./render";

type Hud = {
  phase: Sim["phase"];
  score: number;
  flaps: number;
  air: number;
  hit: HitInfo | null;
};

const INITIAL_HUD: Hud = {
  phase: "ready",
  score: 0,
  flaps: 0,
  air: 0,
  hit: null,
};

const px = (n: number) => `${n.toFixed(2)}px`;

function verdict(hit: HitInfo | null, best: number | null, attempts: number): string {
  if (hit?.kind === "ground") return "지면에 닿으셨습니다. 파이프 규격을 논할 단계가 아닙니다.";
  if (best === null) return "정상 작동입니다.";
  if (best <= MIN_CLIP + 0.05)
    return "하한 0.50px에 붙으셨습니다. 조작에 흠잡을 데가 없고, 그래도 1px 부족합니다.";
  if (best < 1) return `이론상 최솟값 ${px(MIN_CLIP)}까지 ${px(best - MIN_CLIP)} 남았습니다. 그 다음은 없습니다.`;
  if (best < 3) return "조금 더 간격 한가운데로 맞추시면 기록은 줄어듭니다. 통과는 안 됩니다.";
  if (attempts >= 15) return `${attempts}번째 시도입니다. 파이프 규격은 변하지 않습니다.`;
  return "기체 결함은 발견되지 않았습니다.";
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(createSim());
  /** 한 프레임에 한 번만 소비되는 플랩 요청 */
  const flapRef = useRef(false);
  const hitboxRef = useRef(false);

  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [showHitbox, setShowHitbox] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [bestClip, setBestClip] = useState<number | null>(null);

  useEffect(() => {
    hitboxRef.current = showHitbox;
  }, [showHitbox]);

  const flap = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase === "over") {
      simRef.current = createSim();
      setHud(INITIAL_HUD);
      return;
    }
    flapRef.current = true;
  }, []);

  // Space / ↑ / W
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp" && e.code !== "KeyW") return;
      e.preventDefault();
      if (e.repeat) return;
      flap();
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [flap]);

  // 메인 루프
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
    let acc = 0;
    const STEP = 1000 / 60;
    let prev: Hud = INITIAL_HUD;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      acc += Math.min(now - last, 100);
      last = now;

      const sim = simRef.current;
      while (acc >= STEP) {
        const before = sim.phase;
        step(sim, flapRef.current);
        flapRef.current = false;
        acc -= STEP;

        // 충돌한 프레임에 기록을 갱신한다
        if (before === "play" && sim.phase !== "play" && sim.hit) {
          const info = sim.hit;
          setAttempts((n) => n + 1);
          if (info.kind === "pipe") {
            setBestClip((b) => (b === null ? info.clip : Math.min(b, info.clip)));
          }
        }
      }

      draw(ctx, sim, hitboxRef.current);

      const next: Hud = {
        phase: sim.phase,
        score: sim.score,
        flaps: sim.flaps,
        air: Math.floor(sim.air / 6),
        hit: sim.hit,
      };
      if (
        next.phase !== prev.phase ||
        next.score !== prev.score ||
        next.flaps !== prev.flaps ||
        next.air !== prev.air ||
        next.hit !== prev.hit
      ) {
        prev = next;
        setHud(next);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hit = hud.hit;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full max-w-[360px] items-end justify-between font-mono text-sm">
        <div>
          <div className="text-xs opacity-50">통과한 파이프</div>
          <div className="text-2xl font-bold tabular-nums">{hud.score}</div>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-50">최소 겹침 기록</div>
          <div className="text-2xl font-bold tabular-nums">
            {bestClip === null ? "—" : px(bestClip)}
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.preventDefault();
            flap();
          }}
          className="w-full cursor-pointer rounded-xl border border-foreground/20 shadow-2xl"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
        />

        {hud.phase === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 text-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white">
              Space 또는 화면을 눌러 날갯짓
            </span>
          </div>
        )}

        {hud.phase === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/85 px-6 text-center text-white">
            <p className="text-3xl font-bold">추락</p>

            {hit?.kind === "pipe" ? (
              <div className="font-mono text-sm leading-relaxed">
                <p className="opacity-80">
                  위 파이프 {px(Math.max(0, hit.top))} · 아래 파이프{" "}
                  {px(Math.max(0, hit.bottom))} 겹침
                </p>
                <p className="mt-1 text-lg font-bold text-red-400">
                  걸린 양 {px(hit.clip)}
                </p>
                <p className="opacity-60">이론상 최솟값 {px(MIN_CLIP)}</p>
              </div>
            ) : (
              <p className="font-mono text-sm opacity-80">지면 충돌</p>
            )}

            <p className="font-mono text-xs opacity-60">
              날갯짓 {hud.flaps}회 · 비행 {(hud.air / 10).toFixed(1)}초 · 시도{" "}
              {attempts}회
            </p>

            <p className="max-w-[280px] text-sm opacity-70">
              {verdict(hit, bestClip, attempts)}
            </p>

            <button
              onClick={flap}
              className="mt-2 rounded-full bg-white px-6 py-2 font-bold text-black transition hover:opacity-80"
            >
              다시 하기
            </button>
          </div>
        )}
      </div>

      <label className="flex w-full max-w-[360px] cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showHitbox}
          onChange={(e) => setShowHitbox(e.target.checked)}
          className="size-4 accent-red-500"
        />
        <span className="opacity-70">히트박스 표시</span>
        <span className="ml-auto font-mono text-xs opacity-50">
          몸통 {BIRD_H}px / 간격 {GAP}px
        </span>
      </label>

      <div className="w-full max-w-[360px] border-t border-foreground/15 pt-4 text-sm opacity-60">
        <p className="mb-2 font-bold opacity-80">조작</p>
        <ul className="space-y-1">
          <li>
            <kbd className="font-mono">Space</kbd> · <kbd className="font-mono">↑</kbd> ·
            화면 클릭 — 날갯짓
          </li>
          <li>파이프를 통과할 때마다 1점</li>
        </ul>

        <p className="mb-2 mt-4 font-bold opacity-80">규격</p>
        <table className="w-full font-mono text-xs">
          <tbody>
            <tr>
              <td className="py-0.5 opacity-70">새 몸통 높이</td>
              <td className="py-0.5 text-right tabular-nums">{BIRD_H}px</td>
            </tr>
            <tr>
              <td className="py-0.5 opacity-70">파이프 간격</td>
              <td className="py-0.5 text-right tabular-nums">{GAP}px</td>
            </tr>
            <tr className="border-t border-foreground/15">
              <td className="py-0.5 font-bold">여유</td>
              <td className="py-0.5 text-right font-bold tabular-nums text-red-500">
                −{BIRD_H - GAP}px
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-xs leading-relaxed opacity-70">
          히트박스는 원본 관례대로 몸통 기준이며 부리·꼬리·날개는 판정에서
          제외됩니다. 새를 간격 정중앙에 완벽히 맞추셔도 위아래로{" "}
          {px(MIN_CLIP)}씩 파고들기 때문에 걸린 양이 {px(MIN_CLIP)} 밑으로는
          내려가지 않습니다. 게다가 위치는 프레임 단위로 결정되므로 실제로는
          그보다 조금씩 더 걸립니다. 줄이실 수는 있고, 0으로 만드실 수는 없습니다.
        </p>
      </div>
    </div>
  );
}
