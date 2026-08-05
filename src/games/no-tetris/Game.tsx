"use client";

import { useEffect, useReducer } from "react";

/**
 * 테트리스 규칙은 전부 지킨다. 판은 10칸, 줄 삭제도 정상이다.
 * 뺀 것은 I(막대) 하나뿐이다.
 *
 * 클리어 조건은 «한 번에 4줄 삭제»(= 테트리스). 그런데 남은 6종은
 * 어떤 회전 상태에서도 세로로 3칸을 넘지 않으므로, 한 번 놓아서 완성할 수 있는
 * 줄은 최대 3줄이다. 싱글·더블·트리플은 전부 잘 된다. 4줄만 안 된다.
 */
const COLS = 10;
const ROWS = 20;
const PREVIEW = 3;
/** 클리어에 필요한 동시 삭제 줄 수 */
const GOAL = 4;
/** 지운 줄 수별 점수. 인덱스 4는 한 번도 쓰이지 않는다. */
const LINE_SCORE = [0, 100, 300, 500, 800];

type Kind = "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = "" | Kind;
type Piece = { kind: Kind; x: number; y: number; rot: number };

/** 스폰 모양과 회전 박스 크기. I는 빠졌다. */
const SPAWN: Record<Kind, { box: number; cells: [number, number][] }> = {
  O: { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

const KINDS = Object.keys(SPAWN) as Kind[];

const COLOR: Record<Kind, string> = {
  O: "#fbbf24",
  T: "#a78bfa",
  S: "#34d399",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c",
};

/** 박스 안에서 시계방향 90도. (x, y) → (N-1-y, x) */
function rotateCells(cells: [number, number][], box: number): [number, number][] {
  return cells.map(([x, y]) => [box - 1 - y, x]);
}

/** 회전 상태 4개를 미리 만들어 둔다. */
const ROTATIONS = Object.fromEntries(
  KINDS.map((kind) => {
    const { box, cells } = SPAWN[kind];
    const states: [number, number][][] = [cells];
    for (let i = 1; i < 4; i++) states.push(rotateCells(states[i - 1], box));
    return [kind, states];
  }),
) as Record<Kind, [number, number][][]>;

/** 회전이 벽이나 블록에 걸렸을 때 밀어보는 순서. */
const KICKS: [number, number][] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
];

function cellsOf(piece: Piece): [number, number][] {
  return ROTATIONS[piece.kind][piece.rot].map(([x, y]) => [
    piece.x + x,
    piece.y + y,
  ]);
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(""));
}

function collides(board: Cell[][], piece: Piece): boolean {
  return cellsOf(piece).some(
    ([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== ""),
  );
}

function spawn(kind: Kind): Piece {
  return { kind, x: Math.floor((COLS - SPAWN[kind].box) / 2), y: 0, rot: 0 };
}

/**
 * 가방 무작위 추출기. 정석은 7종 한 세트지만, 이 가방에는 6종이 들어간다.
 * 섞는 방식은 그대로 Fisher-Yates다.
 */
function refillBag(): Kind[] {
  const bag = [...KINDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function draw(bag: Kind[]): { piece: Piece; bag: Kind[] } {
  const rest = bag.slice(1);
  return {
    piece: spawn(bag[0]),
    bag: rest.length > PREVIEW ? rest : [...rest, ...refillBag()],
  };
}

/** 꽉 찬 줄을 지운다. 진짜로 지운다. 4줄만 안 나올 뿐이다. */
function clearLines(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const kept = board.filter((row) => !row.every((c) => c !== ""));
  const cleared = ROWS - kept.length;
  const fresh = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(""));
  return { board: [...fresh, ...kept], cleared };
}

function levelOf(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** 레벨이 오르면 진짜로 빨라진다. */
function dropMs(level: number): number {
  return Math.max(110, 800 - (level - 1) * 70);
}

type State = {
  board: Cell[][];
  piece: Piece;
  bag: Kind[];
  hold: Kind | null;
  canHold: boolean;
  score: number;
  lines: number;
  pieces: number;
  /** 마지막 락다운에서 지운 줄 수 */
  last: number;
  /** 한 번에 지운 최고 줄 수. 3에서 멈춘다. */
  best: number;
  over: boolean;
  won: boolean;
};

function initial(): State {
  const first = draw(refillBag());
  return {
    board: emptyBoard(),
    piece: first.piece,
    bag: first.bag,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    pieces: 0,
    last: 0,
    best: 0,
    over: false,
    won: false,
  };
}

function moved(s: State, dx: number, dy: number): State | null {
  const piece = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
  return collides(s.board, piece) ? null : { ...s, piece };
}

/** 굳히기: 판에 박고, 줄을 지우고, 다음 블록을 꺼낸다. */
function lockPiece(s: State): State {
  const board = s.board.map((row) => [...row]);
  for (const [x, y] of cellsOf(s.piece)) {
    if (y >= 0) board[y][x] = s.piece.kind;
  }

  const { board: after, cleared } = clearLines(board);
  const next = draw(s.bag);

  return {
    ...s,
    board: after,
    lines: s.lines + cleared,
    score: s.score + LINE_SCORE[cleared] * levelOf(s.lines),
    pieces: s.pieces + 1,
    last: cleared,
    best: Math.max(s.best, cleared),
    canHold: true,
    piece: next.piece,
    bag: next.bag,
    // 한 번에 4줄을 지우면 끝난다. 판정은 여기 그대로 살아 있다.
    won: cleared >= GOAL,
    over: collides(after, next.piece),
  };
}

type Action =
  | { type: "tick" }
  | { type: "move"; dx: number }
  | { type: "rotate"; dir: number }
  | { type: "soft" }
  | { type: "hard" }
  | { type: "hold" }
  | { type: "restart" };

function reducer(s: State, action: Action): State {
  if (action.type === "restart") return initial();
  if (s.over || s.won) return s;

  switch (action.type) {
    case "tick":
      return moved(s, 0, 1) ?? lockPiece(s);

    case "move":
      return moved(s, action.dx, 0) ?? s;

    case "rotate": {
      const rot = (s.piece.rot + action.dir + 4) % 4;
      for (const [kx, ky] of KICKS) {
        const piece = { ...s.piece, rot, x: s.piece.x + kx, y: s.piece.y + ky };
        if (!collides(s.board, piece)) return { ...s, piece };
      }
      return s;
    }

    case "soft": {
      const next = moved(s, 0, 1);
      return next ? { ...next, score: next.score + 1 } : lockPiece(s);
    }

    case "hard": {
      let cur = s;
      for (let next = moved(cur, 0, 1); next; next = moved(cur, 0, 1)) {
        cur = { ...next, score: next.score + 2 };
      }
      return lockPiece(cur);
    }

    // 홀드. 규칙대로 한 블록에 한 번만 된다. 가방에 I가 없을 뿐이다.
    case "hold": {
      if (!s.canHold) return s;
      const held = s.piece.kind;

      if (s.hold === null) {
        const next = draw(s.bag);
        return {
          ...s,
          hold: held,
          canHold: false,
          piece: next.piece,
          bag: next.bag,
          over: collides(s.board, next.piece),
        };
      }

      const piece = spawn(s.hold);
      return {
        ...s,
        hold: held,
        canHold: false,
        piece,
        over: collides(s.board, piece),
      };
    }
  }
}

const CLEAR_NAME = ["", "싱글", "더블", "트리플"];

/** 마지막 결과에 대한 정직한 코멘트 */
function comment(s: State): string {
  if (s.last === 3) return "트리플입니다. 한 줄이 모자랍니다. 늘 한 줄이 모자랍니다.";
  if (s.last === 2) return "더블. 클리어 조건은 4줄입니다.";
  if (s.last === 1) return "싱글. 클리어 조건은 4줄입니다.";
  if (s.pieces >= 60) return "60개째입니다. 가방에 뭐가 없는지는 이미 아실 겁니다.";
  if (s.pieces >= 30) return "한 번에 4줄만 지우시면 바로 끝납니다.";
  if (s.pieces >= 12) return "우물 잘 파셨습니다. 계속 파시면 됩니다.";
  return "잘 놓으셨습니다.";
}

const KEY_ACTION: Record<string, Action> = {
  ArrowLeft: { type: "move", dx: -1 },
  ArrowRight: { type: "move", dx: 1 },
  ArrowDown: { type: "soft" },
  ArrowUp: { type: "rotate", dir: 1 },
  KeyX: { type: "rotate", dir: 1 },
  KeyZ: { type: "rotate", dir: -1 },
  KeyC: { type: "hold" },
  Space: { type: "hard" },
};

function MiniPiece({ kind }: { kind: Kind | null }) {
  const box = kind ? SPAWN[kind].box : 3;
  const cells = kind ? ROTATIONS[kind][0] : [];
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${box}, 9px)` }}
    >
      {Array.from({ length: box * box }, (_, i) => {
        const x = i % box;
        const y = Math.floor(i / box);
        const on = kind && cells.some(([cx, cy]) => cx === x && cy === y);
        return (
          <div
            key={i}
            className="h-[9px] w-[9px] rounded-[1px]"
            style={{ background: on && kind ? COLOR[kind] : "transparent" }}
          />
        );
      })}
    </div>
  );
}

export default function Game() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const level = levelOf(state.lines);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "tick" }), dropMs(level));
    return () => clearInterval(id);
  }, [level]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = KEY_ACTION[e.code];
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 고스트: 지금 하드드롭하면 놓일 자리
  let ghost = state.piece;
  for (let next = moved(state, 0, 1); next; ) {
    ghost = next.piece;
    next = moved({ ...state, piece: ghost }, 0, 1);
  }

  const active = new Set(cellsOf(state.piece).map(([x, y]) => `${x},${y}`));
  const ghostCells = new Set(cellsOf(ghost).map(([x, y]) => `${x},${y}`));

  const controls: { label: string; action: Action }[] = [
    { label: "←", action: { type: "move", dx: -1 } },
    { label: "↓", action: { type: "soft" } },
    { label: "→", action: { type: "move", dx: 1 } },
    { label: "↻", action: { type: "rotate", dir: 1 } },
    { label: "⤓", action: { type: "hard" } },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm opacity-70">
        목표: 한 번에 {GOAL}줄 삭제. 그때까지 게임은 끝나지 않습니다.
      </p>

      <div className="flex items-start gap-4">
        {/* 판 */}
        <div
          className="grid gap-[1px] rounded-lg border border-foreground/20 bg-foreground/5 p-[3px]"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            width: "min(280px, 62vw)",
          }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const x = i % COLS;
            const y = Math.floor(i / COLS);
            const key = `${x},${y}`;
            const settled = state.board[y][x];
            const color = active.has(key)
              ? COLOR[state.piece.kind]
              : settled !== ""
                ? COLOR[settled]
                : null;

            return (
              <div
                key={key}
                className={`aspect-square rounded-[2px] ${
                  color
                    ? ""
                    : ghostCells.has(key)
                      ? "bg-foreground/20"
                      : "bg-foreground/[0.06]"
                }`}
                style={color ? { background: color } : undefined}
              />
            );
          })}
        </div>

        {/* 사이드 */}
        <div className="flex w-28 flex-col gap-4 text-sm">
          <div>
            <p className="text-xs opacity-60">다음</p>
            <div className="mt-1 flex flex-col gap-2">
              {state.bag.slice(0, PREVIEW).map((kind, i) => (
                <MiniPiece key={`${kind}${i}`} kind={kind} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs opacity-60">홀드</p>
            <div className="mt-1">
              <MiniPiece kind={state.hold} />
            </div>
          </div>

          <dl className="flex flex-col gap-2">
            <div>
              <dt className="text-xs opacity-60">점수</dt>
              <dd className="font-bold tabular-nums">{state.score}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">지운 줄</dt>
              <dd className="font-bold tabular-nums">{state.lines}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">레벨</dt>
              <dd className="font-bold tabular-nums">{level}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">최고 동시</dt>
              <dd className="font-bold tabular-nums">
                {state.best}줄
                {CLEAR_NAME[state.best] ? ` (${CLEAR_NAME[state.best]})` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="min-h-[52px] text-center">
        {state.won ? (
          <p className="text-2xl font-bold">클리어</p>
        ) : state.over ? (
          <>
            <p className="text-2xl font-bold">게임 오버</p>
            <p className="mt-1 text-sm opacity-60">
              {state.lines}줄을 지웠고, 한 번에 최고 {state.best}줄이었습니다.
            </p>
          </>
        ) : (
          <p className="text-sm opacity-60">{comment(state)}</p>
        )}
      </div>

      {/* 모바일 조작 */}
      <div className="flex gap-2 sm:hidden">
        {controls.map((c) => (
          <button
            key={c.label}
            onClick={() => dispatch(c.action)}
            className="h-12 w-12 rounded-lg border border-foreground/20 text-lg hover:bg-foreground/10"
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => dispatch({ type: "restart" })}
        className="rounded-full border border-foreground/20 px-6 py-3 text-sm hover:bg-foreground/10"
      >
        다시 시작
      </button>

      <p className="hidden max-w-md text-center text-xs opacity-50 sm:block">
        ← → 이동 · ↓ 소프트드롭 · ↑ / X 회전 · Z 반시계 · Space 하드드롭 · C 홀드.
        블록은 6종이 든 가방에서 무작위로 나옵니다.
      </p>
    </div>
  );
}
