"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * 4×4 직소. 피스 모양은 진짜 탭/홈으로 만들고, 이웃끼리 같은 곡선을 공유해서
 * 맞물리면 틈 없이 붙는다. 제자리 근처에 놓으면 스냅된다.
 *
 * 상자에는 16피스가 들어 있다. 다만 7번(해가 있는 자리)이 빠지고 그 대신
 * 다른 퍼즐(HARU-0412 「고양이와 털실」) 11번이 들어 있다. 이 피스는 7번 자리와
 * 탭/홈이 네 변 전부 정반대로 생겼고, 판정기는 매번 그걸 정확히 잡아낸다.
 * 그래서 늘 15 / 16에서 끝난다.
 */

const CELL = 100;
const N = 4;
/** 판 둘레에 피스를 흩어 둘 여백 */
const M = 130;
const SIZE = N * CELL + M * 2;

/** 상자에서 빠진 자리. 1행 2열, 해가 있는 칸이다. */
const HOLE = 1 * N + 2;
/** 대신 들어 있는 남의 피스 */
const FAKE = N * N;
const IDS = [...Array.from({ length: N * N }, (_, i) => i).filter((i) => i !== HOLE), FAKE];

const SNAP = 26;
const NEAR = 40;

type Side = -1 | 0 | 1;
/** 위, 오른쪽, 아래, 왼쪽. 1 = 탭(튀어나옴), -1 = 홈(파임), 0 = 테두리 */
type Sides = [Side, Side, Side, Side];

/** 세로 이음매. V[r][c-1] = 1 이면 (r, c-1) 피스가 오른쪽으로 탭을 내민다. */
const V: Side[][] = [
  [1, -1, 1],
  [-1, 1, 1],
  [1, -1, -1],
  [-1, 1, 1],
];
/** 가로 이음매. H[r-1][c] = 1 이면 (r-1, c) 피스가 아래로 탭을 내민다. */
const H: Side[][] = [
  [1, -1, 1, -1],
  [-1, 1, -1, 1],
  [1, 1, -1, -1],
];

const neg = (s: Side): Side => (s === 0 ? 0 : s === 1 ? -1 : 1);

function sidesOf(cell: number): Sides {
  const r = Math.floor(cell / N);
  const c = cell % N;
  return [
    r === 0 ? 0 : neg(H[r - 1][c]),
    c === N - 1 ? 0 : V[r][c],
    r === N - 1 ? 0 : H[r][c],
    c === 0 ? 0 : neg(V[r][c - 1]),
  ];
}

/** 남의 피스. 7번 자리가 요구하는 모양을 네 변 전부 뒤집은 꼴이다. */
const FAKE_SIDES = sidesOf(HOLE).map(neg) as Sides;

function sides(id: number): Sides {
  return id === FAKE ? FAKE_SIDES : sidesOf(id);
}

/**
 * 한 변. A→B로 가면서 n 방향(바깥)으로 s만큼 탭을 낸다.
 * 곡선이 가운데 기준 좌우대칭이라 이웃이 반대 방향으로 그려도 같은 선이 된다.
 */
function edge(ax: number, ay: number, bx: number, by: number, nx: number, ny: number, s: Side): string {
  if (s === 0) return `L${bx},${by}`;
  const p = (a: number, h: number) =>
    `${ax + ((bx - ax) * a) / 100 + nx * h * s},${ay + ((by - ay) * a) / 100 + ny * h * s}`;
  return [
    `L${p(38, 0)}`,
    `C${p(40, 0)} ${p(42, 4)} ${p(40, 8)}`,
    `C${p(36, 16)} ${p(42, 24)} ${p(50, 24)}`,
    `C${p(58, 24)} ${p(64, 16)} ${p(60, 8)}`,
    `C${p(58, 4)} ${p(60, 0)} ${p(62, 0)}`,
    `L${bx},${by}`,
  ].join(" ");
}

function shape([t, r, b, l]: Sides): string {
  return [
    "M0,0",
    edge(0, 0, 100, 0, 0, -1, t),
    edge(100, 0, 100, 100, 1, 0, r),
    edge(100, 100, 0, 100, 0, 1, b),
    edge(0, 100, 0, 0, -1, 0, l),
    "Z",
  ].join(" ");
}

const PATHS: Record<number, string> = Object.fromEntries(
  [...Array.from({ length: N * N }, (_, i) => i), FAKE].map((id) => [id, shape(sides(id))]),
);

function home(cell: number): { x: number; y: number } {
  return { x: M + (cell % N) * CELL, y: M + Math.floor(cell / N) * CELL };
}

const SIDE_NAMES = ["위", "오른쪽", "아래", "왼쪽"];

/** 피스를 칸에 대 봤을 때 변마다 어떻게 되는지. 판정기 본체. */
function fit(id: number, cell: number): { ok: number; report: string } {
  const want = sidesOf(cell);
  const have = sides(id);
  let ok = 0;
  const parts = want.map((w, i) => {
    const h = have[i];
    if (w === h) {
      ok++;
      return `${SIDE_NAMES[i]} 맞음`;
    }
    if (w === 0) return `${SIDE_NAMES[i]} 테두리인데 ${h === 1 ? "탭이 튀어나옴" : "홈이 파임"}`;
    if (h === 1) return `${SIDE_NAMES[i]} 탭끼리 부딪힘`;
    return `${SIDE_NAMES[i]} 홈끼리 만나 빈틈`;
  });
  return { ok, report: parts.join(" · ") };
}

/** 판 둘레 16자리. 위 5, 아래 5, 좌우 3씩. */
const SPOTS: { x: number; y: number }[] = [
  ...Array.from({ length: 5 }, (_, i) => ({ x: 15 + i * 130, y: 15 })),
  ...Array.from({ length: 5 }, (_, i) => ({ x: 15 + i * 130, y: SIZE - 115 })),
  ...[145, 275, 405].flatMap((y) => [
    { x: 15, y },
    { x: SIZE - 115, y },
  ]),
];

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Piece = { x: number; y: number; placed: boolean; flipped: boolean };

/** 피스는 HOLE 자리를 비운 채 0~16으로 인덱싱한다. */
function scatter(rand: () => number): Piece[] {
  const spots = [...SPOTS];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const pieces: Piece[] = Array.from({ length: FAKE + 1 }, () => ({
    x: 0,
    y: 0,
    placed: false,
    flipped: false,
  }));
  IDS.forEach((id, k) => {
    pieces[id] = {
      x: spots[k].x + (rand() - 0.5) * 16,
      y: spots[k].y + (rand() - 0.5) * 16,
      placed: false,
      flipped: false,
    };
  });
  return pieces;
}

function shuffled(rand: () => number): number[] {
  const order = [...IDS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function back(id: number): { code: string; name: string; no: string } {
  if (id === FAKE) return { code: "HARU-0412", name: "고양이와 털실", no: "11" };
  return { code: "HARU-0019", name: "여름 호수", no: String(id + 1).padStart(2, "0") };
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function rejectText(tries: number, report: string, allIn: boolean): string {
  if (!allIn) return `그 자리 모양이 아닙니다. ${report}`;
  if (tries === 1) return `안 들어갑니다. 모양 일치 0 / 4. ${report}`;
  if (tries === 2) return `${report}. 판정은 정확합니다.`;
  if (tries === 3) return "모양만 문제가 아닙니다. 그 자리엔 해가 있어야 하는데 이 피스엔 고양이 눈이 있습니다.";
  if (tries === 4) return "피스를 두 번 눌러 뒤집어 보십시오.";
  return `${tries}번째. 모양 일치는 이번에도 0 / 4입니다.`;
}

/** 상자 그림. 400×400. */
function Lake() {
  return (
    <g>
      <defs>
        <linearGradient id="jg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fb7ea" />
          <stop offset="1" stopColor="#fde4b4" />
        </linearGradient>
        <linearGradient id="jg-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a90c9" />
          <stop offset="1" stopColor="#1d4a7e" />
        </linearGradient>
        <radialGradient id="jg-glow">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-40" y="-40" width="480" height="300" fill="url(#jg-sky)" />
      <circle cx="250" cy="150" r="62" fill="url(#jg-glow)" />
      <circle cx="250" cy="150" r="32" fill="#ffc93c" />
      <circle cx="250" cy="150" r="24" fill="#ffd95e" />
      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="80" cy="70" rx="42" ry="14" />
        <ellipse cx="104" cy="60" rx="26" ry="14" />
        <ellipse cx="340" cy="52" rx="38" ry="12" />
        <ellipse cx="318" cy="44" rx="20" ry="11" />
      </g>
      <polygon
        points="-40,240 -40,190 40,140 110,200 170,130 240,205 300,160 360,120 440,190 440,240"
        fill="#8fa7c8"
      />
      <polygon points="40,140 58,156 48,160 30,152" fill="#ffffff" opacity="0.7" />
      <polygon points="170,130 186,146 174,150 158,144" fill="#ffffff" opacity="0.7" />
      <polygon points="360,120 380,138 366,142 348,136" fill="#ffffff" opacity="0.7" />
      <path d="M-40,240 C40,205 120,215 200,228 C280,240 360,210 440,222 L440,250 L-40,250 Z" fill="#4f9a55" />
      <rect x="-40" y="244" width="480" height="200" fill="url(#jg-water)" />
      <g fill="#ffe082" opacity="0.75">
        <rect x="226" y="262" width="48" height="4" rx="2" />
        <rect x="232" y="280" width="36" height="4" rx="2" />
        <rect x="238" y="300" width="24" height="3" rx="1.5" />
        <rect x="242" y="322" width="16" height="3" rx="1.5" />
        <rect x="246" y="346" width="8" height="2" rx="1" />
      </g>
      <g fill="#ffffff" opacity="0.25">
        <rect x="40" y="290" width="40" height="2" rx="1" />
        <rect x="320" y="310" width="50" height="2" rx="1" />
        <rect x="90" y="360" width="60" height="2" rx="1" />
        <rect x="300" y="380" width="30" height="2" rx="1" />
      </g>
      <g>
        <path d="M100,318 L160,318 L150,332 L110,332 Z" fill="#7b4a2a" />
        <rect x="128" y="282" width="3" height="36" fill="#5b3a22" />
        <path d="M131,284 L154,314 L131,314 Z" fill="#fafafa" />
      </g>
      {[
        [-6, 236, 1.2],
        [22, 240, 1],
        [372, 234, 1.1],
        [398, 240, 0.9],
      ].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x},${y}) scale(${k})`}>
          <rect x="-3" y="-8" width="6" height="12" fill="#5b3a22" />
          <polygon points="0,-62 -20,-8 20,-8" fill="#2f6e3a" />
          <polygon points="0,-76 -14,-34 14,-34" fill="#3b8146" />
        </g>
      ))}
    </g>
  );
}

/** 남의 퍼즐 11번 자리. 피스 좌표(0~100) 기준이다. */
function Cat() {
  return (
    <g>
      <rect x="-40" y="-40" width="180" height="180" fill="#f7c4d6" />
      <g stroke="#e0457b" strokeWidth="3" fill="none" opacity="0.8">
        <path d="M-30,110 C10,80 30,130 60,104 C80,88 70,140 130,120" />
        <path d="M-30,124 C0,100 40,140 70,118" />
      </g>
      <circle cx="130" cy="40" r="78" fill="#9aa1ad" />
      <path d="M86,-40 L104,-6 L70,-20 Z" fill="#9aa1ad" />
      <ellipse cx="86" cy="36" rx="17" ry="13" fill="#d9f56b" />
      <ellipse cx="86" cy="36" rx="3.5" ry="12" fill="#1f2937" />
      <circle cx="82" cy="31" r="2.5" fill="#ffffff" />
      <g stroke="#ffffff" strokeWidth="1.5" opacity="0.9">
        <line x1="70" y1="78" x2="-10" y2="66" />
        <line x1="70" y1="84" x2="-10" y2="88" />
      </g>
    </g>
  );
}

type Drag = {
  id: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  /** 마지막으로 옮긴 위치. 놓을 때 state가 아직 안 따라왔을 수 있어서 따로 든다. */
  x: number;
  y: number;
  moved: boolean;
};

export default function Game() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastTap = useRef<{ id: number; t: number } | null>(null);

  const [pieces, setPieces] = useState<Piece[]>(() => scatter(rng(19)));
  const [order, setOrder] = useState<number[]>(() => shuffled(rng(1019)));
  const [dragging, setDragging] = useState<number | null>(null);
  const [message, setMessage] = useState("16피스입니다. 오래 안 걸립니다. 상자 그림을 보면서 맞추십시오.");
  const [tries, setTries] = useState(0);
  const [flash, setFlash] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const placed = IDS.filter((id) => pieces[id].placed).length;
  const allIn = placed === N * N - 1;

  useEffect(() => {
    if (startedAt === null || stoppedAt !== null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt, stoppedAt]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 700);
    return () => clearTimeout(t);
  }, [flash]);

  // 피스를 잡을 때만 스크롤을 막는다. 빈 데나 맞춰 둔 피스 위에선 페이지가 그대로 스크롤된다.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onTouch(e: TouchEvent) {
      if ((e.target as Element).closest("[data-loose]")) e.preventDefault();
    }
    svg.addEventListener("touchstart", onTouch, { passive: false });
    return () => svg.removeEventListener("touchstart", onTouch);
  }, []);

  function point(e: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function down(e: ReactPointerEvent, id: number) {
    if (pieces[id].placed) return;
    const p = point(e);
    drag.current = {
      id,
      dx: p.x - pieces[id].x,
      dy: p.y - pieces[id].y,
      sx: p.x,
      sy: p.y,
      x: pieces[id].x,
      y: pieces[id].y,
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
    setDragging(id);
    setOrder((o) => [...o.filter((i) => i !== id), id]);
    if (startedAt === null) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
    }
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 4) return;
    d.moved = true;
    const x = clamp(p.x - d.dx, -20, SIZE - 80);
    const y = clamp(p.y - d.dy, -20, SIZE - 80);
    d.x = x;
    d.y = y;
    setPieces((ps) => ps.map((pc, i) => (i === d.id ? { ...pc, x, y } : pc)));
  }

  function tap(id: number) {
    const t = Date.now();
    const prev = lastTap.current;
    lastTap.current = { id, t };
    if (!prev || prev.id !== id || t - prev.t > 350) return;
    lastTap.current = null;

    const flipped = !pieces[id].flipped;
    setPieces((ps) => ps.map((pc, i) => (i === id ? { ...pc, flipped } : pc)));
    if (!flipped) {
      setMessage("다시 앞면입니다.");
      return;
    }
    const b = back(id);
    if (id === FAKE) {
      setMessage(
        `뒷면: ${b.code} 「${b.name}」 16피스 · ${b.no}번. 이 상자는 HARU-0019 「여름 호수」입니다. 7번 피스는 들어 있지 않았습니다. 피스 수는 16개로 정확합니다.`,
      );
    } else {
      setMessage(`뒷면: ${b.code} 「${b.name}」 16피스 · ${b.no}번. 이 상자 피스 맞습니다.`);
    }
  }

  function drop(id: number, x: number, y: number) {
    const pc = { ...pieces[id], x, y };

    if (id !== FAKE) {
      const h = home(id);
      if (Math.abs(pc.x - h.x) > SNAP || Math.abs(pc.y - h.y) > SNAP) return;
      if (pc.flipped) {
        setMessage("뒤집힌 채로는 안 끼워집니다. 그림이 바닥을 보고 있습니다.");
        return;
      }
      setPieces((ps) => ps.map((p, i) => (i === id ? { ...p, ...h, placed: true } : p)));
      const n = placed + 1;
      if (n === N * N - 1) {
        setStoppedAt(Date.now());
        setMessage("15 / 16. 마지막 한 조각입니다. 해 자리만 남았습니다.");
      } else {
        setMessage(`${n} / 16.`);
      }
      return;
    }

    // 남의 피스. 근처 빈칸에 대 보고, 판정하고, 튕겨 낸다.
    const empty = Array.from({ length: N * N }, (_, i) => i).filter(
      (c) => c === HOLE || !pieces[c].placed,
    );
    const cell = empty.find((c) => {
      const h = home(c);
      return Math.abs(pc.x - h.x) < NEAR && Math.abs(pc.y - h.y) < NEAR;
    });
    if (cell === undefined) return;

    const { report } = fit(id, cell);
    const h = home(cell);
    // 판 밖 가까운 쪽으로 튕겨 낸다. 빈자리는 계속 보이게.
    const away = h.y < SIZE / 2 ? 15 : SIZE - 115;
    setPieces((ps) => ps.map((p, i) => (i === id ? { ...p, x: h.x, y: away } : p)));
    setFlash(Date.now());

    if (cell !== HOLE) {
      setMessage(`그 자리 피스가 아닙니다. ${report}`);
      return;
    }
    const t = tries + 1;
    setTries(t);
    setMessage(rejectText(t, report, allIn));
  }

  function up() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(null);
    if (d.moved) drop(d.id, d.x, d.y);
    else tap(d.id);
  }

  function restart() {
    const r = rng(Math.floor(Math.random() * 2 ** 31));
    setPieces(scatter(r));
    setOrder(shuffled(r));
    setTries(0);
    setStartedAt(null);
    setStoppedAt(null);
    setFlash(0);
    setMessage("다시 쏟았습니다. 피스는 이번에도 16개입니다.");
  }

  const elapsed = startedAt === null ? 0 : (stoppedAt ?? now) - startedAt;
  const drawOrder = [...IDS.filter((id) => pieces[id].placed), ...order.filter((id) => !pieces[id].placed)];
  const hole = home(HOLE);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 상자 */}
      <div className="flex items-center gap-3 rounded-lg border border-foreground/15 px-3 py-2">
        <svg viewBox="-6 -6 412 412" className="h-16 w-16 shrink-0 rounded-sm">
          <use href="#jg-lake" />
        </svg>
        <div className="text-xs leading-relaxed">
          <p className="font-mono opacity-50">HARU-0019</p>
          <p className="font-bold">여름 호수</p>
          <p className="opacity-60">16피스 · 4×4 · 소요 시간 약 3분</p>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-xl select-none"
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <defs>
          <g id="jg-lake">
            <Lake />
          </g>
          <g id="jg-cat">
            <Cat />
          </g>
          {[...Array.from({ length: N * N }, (_, i) => i), FAKE].map((id) => (
            <clipPath key={id} id={`jg-clip-${id}`}>
              <path d={PATHS[id]} />
            </clipPath>
          ))}
        </defs>

        {/* 판. 빈 자리마다 원래 피스 윤곽이 인쇄돼 있다. */}
        <rect x={M} y={M} width={N * CELL} height={N * CELL} rx="4" className="fill-foreground/[0.06]" />
        {Array.from({ length: N * N }, (_, cell) => {
          const h = home(cell);
          const red = cell === HOLE && flash > 0;
          return (
            <path
              key={cell}
              d={PATHS[cell]}
              transform={`translate(${h.x},${h.y})`}
              fill="none"
              strokeDasharray="4 4"
              strokeWidth={red ? 2.5 : 1}
              className={red ? "stroke-red-500" : "stroke-foreground/20"}
            />
          );
        })}
        {allIn && (
          <text
            x={hole.x + 50}
            y={hole.y + 56}
            textAnchor="middle"
            fontSize="13"
            className="fill-foreground/40"
          >
            7
          </text>
        )}

        {drawOrder.map((id) => {
          const pc = pieces[id];
          const r = Math.floor(id / N);
          const c = id % N;
          const lifted = dragging === id;
          const b = back(id);
          return (
            <g
              key={id}
              data-id={id}
              data-loose={pc.placed ? undefined : ""}
              onPointerDown={(e) => down(e, id)}
              style={{
                transform: `translate(${pc.x}px, ${pc.y}px)`,
                transition: lifted ? "none" : "transform 160ms ease-out",
              }}
              className={pc.placed ? "" : lifted ? "cursor-grabbing" : "cursor-grab"}
            >
              <g
                transform={pc.flipped ? "translate(100,0) scale(-1,1)" : undefined}
                style={{ filter: pc.placed ? undefined : `drop-shadow(0 ${lifted ? 6 : 2}px ${lifted ? 6 : 2}px rgb(0 0 0 / 0.35))` }}
              >
                <g clipPath={`url(#jg-clip-${id})`}>
                  {pc.flipped ? (
                    <rect x="-30" y="-30" width="160" height="160" fill="#cbb08a" />
                  ) : id === FAKE ? (
                    <use href="#jg-cat" />
                  ) : (
                    <use href="#jg-lake" x={-c * CELL} y={-r * CELL} />
                  )}
                </g>
                <path
                  d={PATHS[id]}
                  fill="none"
                  strokeWidth={id === FAKE && flash > 0 ? 3 : 1}
                  stroke={id === FAKE && flash > 0 ? "#ef4444" : pc.placed ? "rgb(0 0 0 / 0.12)" : "rgb(0 0 0 / 0.3)"}
                />
              </g>
              {pc.flipped && (
                <g fill="#6b5435" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  <text x="50" y="40" fontSize="10">
                    {b.code}
                  </text>
                  <text x="50" y="56" fontSize="10">
                    {b.name}
                  </text>
                  <text x="50" y="74" fontSize="14" fontWeight="bold">
                    {b.no}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <dl className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-xs opacity-60">맞춘 피스</dt>
          <dd className="font-bold tabular-nums">
            {placed} / 16 <span className="font-normal opacity-50">({((placed / 16) * 100).toFixed(2)}%)</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">{allIn ? "15피스까지" : "시간"}</dt>
          <dd className="font-bold tabular-nums">{clock(elapsed)}</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">완성 시간</dt>
          <dd className="font-bold tabular-nums">—</dd>
        </div>
        {tries > 0 && (
          <div>
            <dt className="text-xs opacity-60">마지막 자리 시도</dt>
            <dd className="font-bold tabular-nums">{tries}회</dd>
          </div>
        )}
      </dl>

      <p className="min-h-[60px] max-w-md text-center text-sm opacity-70">{message}</p>

      <button
        onClick={restart}
        className="rounded-full border border-foreground/20 px-5 py-2.5 text-sm hover:bg-foreground/10"
      >
        다 쏟고 처음부터
      </button>

      <p className="max-w-md text-center text-xs opacity-50">
        피스는 근처에 놓으면 제자리로 붙습니다. 두 번 누르면 뒤집어서 뒷면을 볼 수 있습니다. 누락·혼입
        피스는 구입처에 문의하십시오.
      </p>
    </div>
  );
}
