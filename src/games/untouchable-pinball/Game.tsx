"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createGame, H, step, W, type Game as GameState, type Input } from "./engine";
import { draw } from "./render";

type KeyName = keyof Input;

const KEY_NAMES: KeyName[] = ["left", "right", "space"];

const KEY_MAP: Record<string, KeyName> = {
  KeyZ: "left",
  ArrowLeft: "left",
  Slash: "right",
  ArrowRight: "right",
  Space: "space",
};

type Hud = {
  phase: GameState["phase"];
  score: number;
  ballsLeft: number;
  swings: number;
  hits: number;
  saves: number;
  blocked: boolean;
  elapsed: number;
};

const INITIAL_HUD: Hud = {
  phase: "ready",
  score: 0,
  ballsLeft: 3,
  swings: 0,
  hits: 0,
  saves: 0,
  blocked: false,
  elapsed: 0,
};

function verdict(hud: Hud): string {
  if (hud.swings === 0) return "한 번도 휘두르지 않으셨습니다. 그게 제일 효율적이긴 합니다.";
  if (hud.swings >= 60) return `${hud.swings}번 휘두르셨습니다. 팔은 괜찮으신가요.`;
  if (hud.score >= 3000) return "점수는 훌륭합니다. 공을 친 적은 없습니다.";
  return "기계 결함은 발견되지 않았습니다.";
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const inputRef = useRef<Input>({ left: false, right: false, space: false });
  /** 눌림을 엔진이 최소 2스텝은 보도록 붙잡아 둔다 (짧은 탭이 통째로 씹히는 것 방지) */
  const holdRef = useRef<Record<KeyName, number>>({ left: 0, right: 0, space: 0 });
  const releaseRef = useRef<Record<KeyName, boolean>>({
    left: false,
    right: false,
    space: false,
  });
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);

  const press = useCallback((key: KeyName, down: boolean) => {
    if (down) {
      inputRef.current[key] = true;
      holdRef.current[key] = 2;
      releaseRef.current[key] = false;
    } else if (holdRef.current[key] > 0) {
      releaseRef.current[key] = true;
    } else {
      inputRef.current[key] = false;
    }
  }, []);

  const restart = useCallback(() => {
    gameRef.current = createGame();
    inputRef.current = { left: false, right: false, space: false };
    holdRef.current = { left: 0, right: 0, space: 0 };
    releaseRef.current = { left: false, right: false, space: false };
    setHud(INITIAL_HUD);
  }, []);

  // 키 입력: ㅋ(Z) 왼쪽, /(Slash) 오른쪽, Space 발사
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (!key) return;
      e.preventDefault();
      if (e.repeat) return;
      press(key, true);
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (!key) return;
      e.preventDefault();
      press(key, false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [press]);

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
      const g = gameRef.current;
      while (acc >= STEP) {
        for (const key of KEY_NAMES) {
          if (holdRef.current[key] > 0) holdRef.current[key] -= 1;
          else if (releaseRef.current[key]) {
            inputRef.current[key] = false;
            releaseRef.current[key] = false;
          }
        }
        step(g, inputRef.current);
        acc -= STEP;
      }
      draw(ctx, g);

      const next: Hud = {
        phase: g.phase,
        score: g.score,
        ballsLeft: g.ballsLeft,
        swings: g.swings,
        hits: g.hits,
        saves: g.saves,
        blocked: g.flippers.some((f) => f.blocked),
        elapsed: Math.floor(g.elapsed / 60),
      };
      if (
        next.phase !== prev.phase ||
        next.score !== prev.score ||
        next.ballsLeft !== prev.ballsLeft ||
        next.swings !== prev.swings ||
        next.hits !== prev.hits ||
        next.saves !== prev.saves ||
        next.blocked !== prev.blocked ||
        next.elapsed !== prev.elapsed
      ) {
        prev = next;
        setHud(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hold = (key: KeyName) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      press(key, true);
    },
    onPointerUp: () => press(key, false),
    onPointerLeave: () => press(key, false),
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full max-w-[360px] items-end justify-between font-mono text-sm">
        <div>
          <div className="text-xs opacity-50">SCORE</div>
          <div className="text-2xl font-bold tabular-nums">{hud.score.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-50">BALL</div>
          <div className="text-2xl font-bold tabular-nums">{"●".repeat(hud.ballsLeft) || "—"}</div>
        </div>
      </div>

      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-foreground/20 shadow-2xl"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
        />

        {hud.phase === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white">
              Space를 눌러 발사 (길게 누를수록 세게)
            </span>
          </div>
        )}

        {hud.blocked && hud.phase === "play" && (
          <div className="pointer-events-none absolute inset-x-0 top-4 text-center">
            <span className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-bold text-white">
              안전장치 작동 — 공이 가까워 플리퍼를 내렸습니다
            </span>
          </div>
        )}

        {hud.phase === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/85 px-6 text-center text-white">
            <p className="text-3xl font-bold">GAME OVER</p>
            <p className="font-mono text-xl">{hud.score.toLocaleString()}점</p>
            <div className="font-mono text-sm leading-relaxed opacity-80">
              <p>플리퍼 작동 {hud.swings}회 (전부 정상)</p>
              <p>안전장치 작동 {hud.saves}회</p>
              <p className="text-red-400">공을 쳐올린 횟수 {hud.hits}회</p>
            </div>
            <p className="max-w-[260px] text-sm opacity-70">{verdict(hud)}</p>
            <button
              onClick={restart}
              className="mt-2 rounded-full bg-white px-6 py-2 font-bold text-black transition hover:opacity-80"
            >
              다시 하기
            </button>
          </div>
        )}
      </div>

      {/* 모바일용. 키보드와 완전히 동일하게 작동합니다. */}
      <div className="flex w-full max-w-[360px] gap-2 sm:hidden">
        <button
          {...hold("left")}
          className="flex-1 rounded-lg border border-foreground/20 py-4 font-bold active:bg-foreground/10"
        >
          ㅋ
        </button>
        <button
          {...hold("space")}
          className="flex-[1.4] rounded-lg border border-foreground/20 py-4 text-sm font-bold active:bg-foreground/10"
        >
          발사
        </button>
        <button
          {...hold("right")}
          className="flex-1 rounded-lg border border-foreground/20 py-4 font-bold active:bg-foreground/10"
        >
          /
        </button>
      </div>

      <div className="w-full max-w-[360px] border-t border-foreground/15 pt-4 text-sm opacity-60">
        <p className="mb-2 font-bold opacity-80">조작</p>
        <ul className="space-y-1">
          <li>
            <kbd className="font-mono">ㅋ</kbd> 왼쪽 플리퍼 ·{" "}
            <kbd className="font-mono">/</kbd> 오른쪽 플리퍼
          </li>
          <li>
            <kbd className="font-mono">Space</kbd> 길게 눌러 발사
          </li>
          <li>범퍼 100점 · 슬링샷 50점 · 포스트 10점</li>
        </ul>
        <p className="mt-3 text-xs opacity-70">
          이 기기에는 공이 플리퍼에 접근하면 플리퍼를 내리는 안전장치가 탑재되어
          있습니다. 파손 방지를 위한 것이며 정상 동작입니다.
        </p>
      </div>
    </div>
  );
}
