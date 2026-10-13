"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { createSim, DT, FRUITS, H, pick, step, W, type Sim } from "./engine";
import { draw } from "./render";

/**
 * 감나무다. 잡고 흔들면 고무처럼 휘었다가 띠용거리고, 꼭지 장력이 한계를 넘은 감은 떨어진다.
 * 물리는 engine.ts에 있고 대충이 아니다.
 *
 * 다만 나무가 언덕 꼭대기에 심겨 있어서 떨어진 감은 전부 굴러서 화면 밖으로 나간다.
 * 수확은 늘 0개다. 그리고 한 철에 한 번이다. 다 떨어지면 다음 감은 정확히 7일 뒤에 열리고,
 * 그동안 꽃눈이 실제 시간에 맞춰 자란다. 기록은 localStorage에 남는다.
 */

const KEY = "haru:rubber-persimmon";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const ALL = FRUITS.map((f) => f.id);

type Crop = {
  season: number;
  /** 아직 달려 있는 감 */
  left: number[];
  /** 마지막 감이 떨어진 시각. 여기서 7일 */
  emptyAt: number | null;
  /** 누적. 떨어뜨린 감 */
  dropped: number;
  /** 누적. 나무를 잡은 횟수 */
  shakes: number;
};

const FRESH: Crop = { season: 1, left: ALL, emptyAt: null, dropped: 0, shakes: 0 };

/** 정적 HTML에는 기록이 없다. 하이드레이션 뒤에 진짜 값으로 다시 그린다. */
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
      // 저장소가 막혀 있으면 이번 방문 동안만 기억합니다. 감은 그래도 일주일에 한 번입니다.
      cached = null;
    }
  }
  return cached;
}

function serverSnapshot(): Snapshot {
  return PENDING;
}

function save(rec: Crop) {
  const raw = JSON.stringify(rec);
  cached = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // 위와 같습니다.
  }
  for (const fn of listeners) fn();
}

function parse(raw: string | null): Crop {
  if (!raw) return FRESH;
  try {
    const v = JSON.parse(raw) as Partial<Crop>;
    return {
      season: typeof v.season === "number" ? v.season : 1,
      left: Array.isArray(v.left) ? v.left.filter((id) => ALL.includes(id)) : ALL,
      emptyAt: typeof v.emptyAt === "number" ? v.emptyAt : null,
      dropped: typeof v.dropped === "number" ? v.dropped : 0,
      shakes: typeof v.shakes === "number" ? v.shakes : 0,
    };
  } catch {
    return FRESH;
  }
}

/** 일주일이 지났으면 새 감이 열린다. 하루도 일찍 열리지 않는다. */
function ripen(rec: Crop, now: number): Crop {
  if (rec.emptyAt === null || now < rec.emptyAt + WEEK) return rec;
  return { ...rec, season: rec.season + 1, left: ALL, emptyAt: null };
}

function countdown(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d}일 ${p(h)}:${p(m)}:${p(s)}`;
}

function opening(rec: Crop): string {
  if (rec.left.length === 0) return "이번 철 감은 다 떨어졌습니다. 다음 감이 열릴 때까지 기다리십시오.";
  if (rec.left.length < ALL.length)
    return `지난번에 남기신 감 ${rec.left.length}개가 그대로 달려 있습니다.`;
  if (rec.season > 1) return `새 감이 열렸습니다. ${rec.season}번째 철입니다. 이번에도 한 번뿐입니다.`;
  return "감이 7개 열렸습니다. 나무를 잡고 흔드십시오. 한 철에 한 번입니다.";
}

function releaseText(rec: Crop): string {
  if (rec.left.length === 0) {
    if (rec.shakes % 5 === 0) return `${rec.shakes}번 흔드셨습니다. 일주일은 1초도 줄지 않았습니다.`;
    return "흔드셔도 일주일입니다.";
  }
  if (rec.left.length === ALL.length) return "그 정도로는 안 떨어집니다. 감 꼭지는 생각보다 질깁니다.";
  return "남은 것들은 꼭지가 더 질깁니다. 더 세게 튕기십시오.";
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const seasonRef = useRef(0);
  const recRef = useRef<Crop>(FRESH);
  const droppedInGrab = useRef(false);
  /** 지금 나무를 잡고 있는 포인터. 두 번째 손가락은 무시한다. */
  const grabPointer = useRef<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(releaseTimer.current), []);

  const raw = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
  const ready = raw !== PENDING;
  const rec = ready ? parse(raw) : null;
  recRef.current = rec ?? FRESH;

  const [message, setMessage] = useState<string | null>(null);

  /** 한 프레임에 감이 둘 떨어질 수도 있어서, 렌더를 기다리지 않고 ref부터 갱신한다. */
  function commit(next: Crop) {
    recRef.current = next;
    save(next);
  }
  const [now, setNow] = useState(0);

  // 1초마다 시계. 일주일이 다 됐으면 여기서 새 감이 열린다.
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const cur = recRef.current;
      const next = ripen(cur, t);
      if (next !== cur) {
        commit(next);
        setMessage(opening(next));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let ink = getComputedStyle(canvas).color;
    let frame = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const rec = recRef.current;
      if (!simRef.current || seasonRef.current !== rec.season) {
        const prev = simRef.current;
        simRef.current = createSim(rec.left, prev ?? undefined);
        if (prev) simRef.current.grab = prev.grab;
        seasonRef.current = rec.season;
      }
      const sim = simRef.current;

      acc += Math.min(0.05, (t - last) / 1000);
      last = t;
      while (acc >= DT) {
        step(sim);
        acc -= DT;
      }

      for (const e of sim.events) {
        const cur = recRef.current;
        if (e.type === "drop") {
          droppedInGrab.current = true;
          const left = cur.left.filter((id) => id !== e.id);
          commit({
            ...cur,
            left,
            dropped: cur.dropped + 1,
            emptyAt: left.length === 0 ? Date.now() : cur.emptyAt,
          });
          setMessage("툭.");
        } else if (e.type === "land") {
          setMessage("떨어졌습니다. 주우시려고요? 여긴 언덕입니다.");
        } else {
          const hanging = cur.left.length;
          const rolling = sim.fruits.filter((f) => f.state === "fall").length;
          if (hanging === 0 && rolling === 0) {
            setMessage("다 떨어졌습니다. 다 굴러갔습니다. 수확은 0개입니다. 다음 감은 일주일 뒤에 열립니다.");
          } else {
            setMessage(`굴러갔습니다. 남은 감 ${hanging}개, 수확 0개.`);
          }
        }
      }
      sim.events = [];

      if (++frame % 60 === 0) ink = getComputedStyle(canvas).color;
      const r = recRef.current;
      const bud = r.emptyAt === null ? null : Math.min(1, (Date.now() - r.emptyAt) / WEEK);
      draw(ctx, sim, ink, bud);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 나무를 잡을 때만 스크롤을 막는다. 빈 하늘을 문지르면 페이지가 그대로 스크롤된다.
    const onTouch = (e: TouchEvent) => {
      const sim = simRef.current;
      const touch = e.touches[0];
      if (!sim || !touch) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * W;
      const y = ((touch.clientY - rect.top) / rect.height) * H;
      if (pick(sim, x, y)) e.preventDefault();
    };
    canvas.addEventListener("touchstart", onTouch, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("touchstart", onTouch);
    };
  }, [ready]);

  function local(e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    const sim = simRef.current;
    if (!sim || !e.isPrimary || grabPointer.current !== null) return;
    const p = local(e);
    const hit = pick(sim, p.x, p.y);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grabPointer.current = e.pointerId;
    sim.grab = { ...hit, target: p };
    clearTimeout(releaseTimer.current);
    droppedInGrab.current = false;
    const cur = recRef.current;
    commit({ ...cur, shakes: cur.shakes + 1 });
    e.currentTarget.style.cursor = "grabbing";
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const sim = simRef.current;
    if (!sim) return;
    const p = local(e);
    if (grabPointer.current !== null) {
      if (e.pointerId === grabPointer.current && sim.grab) sim.grab.target = p;
      return;
    }
    e.currentTarget.style.cursor = pick(sim, p.x, p.y) ? "grab" : "default";
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== grabPointer.current) return;
    grabPointer.current = null;
    const sim = simRef.current;
    if (!sim?.grab) return;
    sim.grab = null;
    e.currentTarget.style.cursor = "grab";
    // 놓는 순간 튕겨서 떨어지는 경우가 많으니 조금 기다렸다가 판정한다.
    // 그 사이에 다시 잡으면 이 판정은 취소된다.
    releaseTimer.current = setTimeout(() => {
      if (!droppedInGrab.current) setMessage(releaseText(recRef.current));
    }, 900);
  }

  const left = rec?.left.length ?? ALL.length;
  const empty = rec !== null && rec.emptyAt !== null;
  const remain = empty && now ? rec.emptyAt! + WEEK - now : 0;
  const budPct = empty && now ? Math.min(100, ((now - rec.emptyAt!) / WEEK) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="aspect-[360/440] w-full max-w-[360px] select-none text-foreground"
      />

      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm">
        <div>
          <dt className="text-xs opacity-60">달린 감</dt>
          <dd className="font-bold tabular-nums">
            {left} / {ALL.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">수확</dt>
          <dd className="font-bold tabular-nums">0개</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">떨어뜨림 (누적)</dt>
          <dd className="font-bold tabular-nums">{rec?.dropped ?? 0}개</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">흔든 횟수</dt>
          <dd className="font-bold tabular-nums">{rec?.shakes ?? 0}회</dd>
        </div>
      </dl>

      {empty && now > 0 && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-foreground/15 px-5 py-3">
          <p className="text-xs opacity-60">다음 감까지</p>
          <p className="font-mono text-2xl font-bold tabular-nums">{countdown(remain)}</p>
          <p className="font-mono text-xs tabular-nums opacity-60">꽃눈 {budPct.toFixed(5)}%</p>
        </div>
      )}

      <p className="min-h-[40px] max-w-md text-center text-sm opacity-70">
        {message ?? (rec ? opening(rec) : "")}
      </p>

      <p className="max-w-md text-center text-xs opacity-50">
        가지를 잡고 끌었다 놓으면 휩니다. 감마다 꼭지가 버티는 힘이 달라서 살살 흔들면 안 떨어집니다.
        감은 한 철에 한 번 열리고, 다 떨어지면 다음 감은 7일 뒤입니다.
      </p>
    </div>
  );
}
