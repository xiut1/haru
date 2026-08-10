"use client";

import { useEffect, useState } from "react";

/**
 * 오목 규칙은 전부 지킨다. 흑 선착, 번갈아 착수, 가로·세로·두 대각선 어느
 * 방향으로든 다섯 개를 먼저 이으면 승리. 판정기도 AI도 진짜다.
 *
 * 뺀 것은 판 크기뿐이다. 4×4에는 길이 5짜리 직선이 한 줄도 존재하지 않으므로
 * 승리 판정이 검사할 라인 자체가 0개다. 16칸을 다 채우면 반드시 무승부다.
 */
const SIZE = 4;
const NEED = 5;
const CELLS = SIZE * SIZE;
const MAX_DEPTH = 4;
const WIN = 1_000_000;

type Stone = "B" | "W";
type Cell = "" | Stone;
type Result = null | "draw" | Stone;

const COL_LABEL = ["A", "B", "C", "D"];

/** 4방향: → ↓ ↘ ↗ */
const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/**
 * 승패를 가를 수 있는 길이 NEED짜리 직선을 전부 모아 둔다.
 * 판을 벗어나는 줄은 당연히 제외한다. 그래서 이 배열은 비어 있다.
 */
function buildWindows(): number[][] {
  const windows: number[][] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      for (const [dx, dy] of DIRS) {
        const ex = x + dx * (NEED - 1);
        const ey = y + dy * (NEED - 1);
        if (ex < 0 || ex >= SIZE || ey < 0 || ey >= SIZE) continue;
        const line: number[] = [];
        for (let i = 0; i < NEED; i++) line.push((y + dy * i) * SIZE + (x + dx * i));
        windows.push(line);
      }
    }
  }
  return windows;
}

const WINDOWS = buildWindows();

function other(stone: Stone): Stone {
  return stone === "B" ? "W" : "B";
}

function emptyBoard(): Cell[] {
  return Array<Cell>(CELLS).fill("");
}

/** 다섯 개가 이어졌는지 본다. 검사할 줄이 없으면 아무 일도 일어나지 않는다. */
function findWinner(board: Cell[]): { stone: Stone; line: number[] } | null {
  for (const line of WINDOWS) {
    const first = board[line[0]];
    if (first && line.every((i) => board[i] === first)) {
      return { stone: first, line };
    }
  }
  return null;
}

/** 한 줄 안에 돌이 n개 있을 때의 가치. 정석적인 형세 판단이다. */
const SHAPE = [0, 1, 25, 500, 9000, WIN];

/**
 * 형세 판단. 상대 돌이 섞인 줄은 죽은 줄로 보고 버린다.
 * 살아 있는 줄이 하나도 없으므로 모든 국면의 점수는 0이다.
 */
function evaluate(board: Cell[], me: Stone): number {
  let score = 0;
  for (const line of WINDOWS) {
    let mine = 0;
    let yours = 0;
    for (const i of line) {
      const c = board[i];
      if (c === me) mine++;
      else if (c) yours++;
    }
    if (mine && yours) continue;
    score += SHAPE[mine] - SHAPE[yours] * 2;
  }
  return score;
}

const CENTER = [5, 6, 9, 10];

/** 중앙에서 가까운 순. 착수 후보는 놓인 돌 주변부터 본다. */
function distanceFromCenter(i: number): number {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  return Math.abs(x - (SIZE - 1) / 2) + Math.abs(y - (SIZE - 1) / 2);
}

function candidates(board: Cell[]): number[] {
  const near: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i]) continue;
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    let touching = false;
    for (let dy = -1; dy <= 1 && !touching; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
        if (board[ny * SIZE + nx]) {
          touching = true;
          break;
        }
      }
    }
    if (touching) near.push(i);
  }
  const pool = near.length ? near : CENTER.filter((i) => !board[i]);
  return pool.sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b));
}

/** 알파-베타 가지치기가 붙은 미니맥스. 잘라내기도 정상 작동한다. */
function search(
  board: Cell[],
  me: Stone,
  turn: Stone,
  depth: number,
  alpha: number,
  beta: number,
  stat: { nodes: number },
): number {
  stat.nodes++;

  const winner = findWinner(board);
  if (winner) return winner.stone === me ? WIN - depth : -WIN + depth;

  const moves = candidates(board);
  if (depth >= MAX_DEPTH || moves.length === 0) return evaluate(board, me);

  const maximizing = turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const i of moves) {
    board[i] = turn;
    const score = search(board, me, other(turn), depth + 1, alpha, beta, stat);
    board[i] = "";

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }

  return best;
}

type Thought = { index: number; score: number; nodes: number };

/** 후보를 전부 읽어 보고 제일 좋은 수를 고른다. 동점이면 아무거나 고른다. */
function think(board: Cell[], me: Stone): Thought | null {
  const work = [...board];
  const moves = candidates(work);
  if (moves.length === 0) return null;

  const stat = { nodes: 0 };
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const i of moves) {
    work[i] = me;
    const score = search(work, me, other(me), 1, -Infinity, Infinity, stat);
    work[i] = "";

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [i];
    } else if (score === bestScore) {
      bestMoves.push(i);
    }
  }

  return {
    index: bestMoves[Math.floor(Math.random() * bestMoves.length)],
    score: bestScore,
    nodes: stat.nodes,
  };
}

function coord(i: number): string {
  return `${COL_LABEL[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
}

/** 무승부를 몇 번이나 봤는지에 따라 태도가 조금씩 나빠진다. */
function drawComment(draws: number): string {
  if (draws >= 8) return `${draws}판째입니다. 이쯤 되면 판을 의심하셔야 합니다.`;
  if (draws >= 5) return `${draws}판째 무승부입니다. 승리 조건은 계속 5목입니다.`;
  if (draws >= 3) return "세 판 넘게 두셨습니다. 판정기는 아주 잘 돌아가고 있습니다.";
  if (draws === 2) return "또 무승부입니다. 다음 판은 다를지도 모릅니다.";
  return "16칸을 다 쓰셨는데 다섯 개가 안 이어졌습니다. 무승부입니다.";
}

function playComment(moves: number, thought: Thought | null): string {
  if (moves === 0) return "흑이 선입니다. 아무 데나 놓으십시오.";
  if (thought) return `상대가 ${coord(thought.index)}에 뒀습니다. ${thought.nodes}개의 수를 읽었습니다.`;
  return "두실 차례입니다.";
}

export default function Game() {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [turn, setTurn] = useState<Stone>("B");
  const [result, setResult] = useState<Result>(null);
  const [last, setLast] = useState<number | null>(null);
  const [thought, setThought] = useState<Thought | null>(null);
  const [draws, setDraws] = useState(0);

  const placed = board.filter(Boolean).length;
  const thinking = turn === "W" && result === null;

  function settle(next: Cell[], stone: Stone) {
    const winner = findWinner(next);
    if (winner) {
      setResult(winner.stone);
      return;
    }
    if (next.every(Boolean)) {
      setResult("draw");
      setDraws((d) => d + 1);
      return;
    }
    setTurn(other(stone));
  }

  function play(i: number) {
    if (result || turn !== "B" || board[i]) return;
    const next = [...board];
    next[i] = "B";
    setBoard(next);
    setLast(i);
    setThought(null);
    settle(next, "B");
  }

  // 상대 차례. 생각하는 척이 아니라 실제로 탐색한 뒤에 둔다.
  useEffect(() => {
    if (!thinking) return;

    const decision = think(board, "W");
    const id = setTimeout(() => {
      if (!decision) return;
      const next = [...board];
      next[decision.index] = "W";
      setBoard(next);
      setLast(decision.index);
      setThought(decision);
      settle(next, "W");
    }, 420);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking, board]);

  function restart() {
    setBoard(emptyBoard());
    setTurn("B");
    setResult(null);
    setLast(null);
    setThought(null);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm opacity-70">
        가로·세로·대각선으로 {NEED}개를 먼저 이으면 승리합니다. 당신이 흑, 선입니다.
      </p>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* 판 */}
        <div className="flex flex-col items-center">
          <div className="flex pl-6">
            {COL_LABEL.map((label) => (
              <span
                key={label}
                className="w-[clamp(52px,15vw,70px)] text-center font-mono text-xs opacity-40"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex">
            <div className="flex flex-col justify-around pr-2">
              {Array.from({ length: SIZE }, (_, y) => (
                <span
                  key={y}
                  className="flex h-[clamp(52px,15vw,70px)] items-center font-mono text-xs opacity-40"
                >
                  {y + 1}
                </span>
              ))}
            </div>

            {/* 판은 어느 테마에서든 나무판 색이다. 흑백 돌이 둘 다 보여야 한다. */}
            <div className="grid grid-cols-4 gap-[2px] rounded-lg border border-stone-500/40 bg-stone-400 p-[2px]">
              {board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => play(i)}
                  disabled={!!cell || !!result || turn !== "B"}
                  aria-label={coord(i)}
                  className="flex h-[clamp(52px,15vw,70px)] w-[clamp(52px,15vw,70px)] items-center justify-center rounded-[3px] bg-stone-200 transition-colors enabled:hover:bg-stone-300"
                >
                  {cell && (
                    <span
                      className={`block h-[76%] w-[76%] rounded-full border shadow-sm ${
                        cell === "B"
                          ? "border-neutral-700 bg-neutral-900"
                          : "border-neutral-400 bg-neutral-100"
                      } ${last === i ? "ring-2 ring-sky-500/70" : ""}`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 판정기 */}
        <dl className="flex w-full flex-row flex-wrap gap-x-6 gap-y-3 text-sm sm:w-36 sm:flex-col">
          <div>
            <dt className="text-xs opacity-60">차례</dt>
            <dd className="font-bold">
              {result ? "—" : turn === "B" ? "당신 (흑)" : "상대 (백)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">놓인 돌</dt>
            <dd className="font-bold tabular-nums">
              {placed} / {CELLS}
            </dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">누적 무승부</dt>
            <dd className="font-bold tabular-nums">{draws}판</dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">승리 조건</dt>
            <dd className="font-bold tabular-nums">{NEED}목</dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">검사 중인 라인</dt>
            <dd className="font-bold tabular-nums">{WINDOWS.length}개</dd>
          </div>
        </dl>
      </div>

      <div className="min-h-[52px] text-center">
        {result === "draw" ? (
          <>
            <p className="text-2xl font-bold">무승부</p>
            <p className="mt-1 text-sm opacity-60">{drawComment(draws)}</p>
          </>
        ) : result ? (
          <p className="text-2xl font-bold">
            {result === "B" ? "당신이 이겼습니다" : "당신이 졌습니다"}
          </p>
        ) : thinking ? (
          <p className="text-sm opacity-60">상대가 수를 읽고 있습니다…</p>
        ) : (
          <p className="text-sm opacity-60">{playComment(placed, thought)}</p>
        )}
      </div>

      <button
        onClick={restart}
        className="rounded-full border border-foreground/20 px-6 py-3 text-sm hover:bg-foreground/10"
      >
        다시 두기
      </button>

      <p className="max-w-md text-center text-xs opacity-50">
        상대는 알파-베타 가지치기가 붙은 미니맥스로 {MAX_DEPTH}수 앞까지 읽습니다.
        형세 판단은 길이 {NEED}짜리 직선을 하나씩 세는 방식입니다.
      </p>
    </div>
  );
}
