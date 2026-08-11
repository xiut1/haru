"use client";

import { useEffect, useState } from "react";

/**
 * 틱택토 규칙은 전부 지킨다. 번갈아 한 칸씩, 가로·세로·대각선 여덟 줄 중
 * 하나를 먼저 채우면 승리. 승자 판정기는 완성된 줄에 놓인 마크를 읽어서
 * 그 마크의 승리를 선언한다. 교과서에 나오는 그대로다.
 *
 * 뺀 것은 마크 한 종류다. 이 게임에 존재하는 마크는 O뿐이라, 판정기는
 * 매번 정확하게 «O의 승리»를 선언한다. 그건 아무의 승리도 아니다.
 *
 * 보시기 편하시라고 선수는 빨강, 후수는 파랑으로 칠해 둔다. 색은 화면에만
 * 있고 판(board)에는 없다. 판정기가 읽는 것은 마크뿐이므로 빨강 둘에
 * 파랑 하나로 채워진 줄도 정확히 «O의 승리»가 된다.
 */
const CELLS = 9;
const MARK = "O" as const;

type Mark = typeof MARK;
type Cell = "" | Mark;
type Side = "you" | "cpu";

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const COL_LABEL = ["A", "B", "C"];

/** 화면에만 존재하는 구분. 판정기는 이 값을 절대 보지 않는다. */
const INK: Record<Side, string> = {
  you: "text-red-500",
  cpu: "text-blue-500",
};

const SIDE_NAME: Record<Side, string> = {
  you: "당신",
  cpu: "상대",
};

function emptyBoard(): Cell[] {
  return Array<Cell>(CELLS).fill("");
}

function noOwners(): (Side | null)[] {
  return Array<Side | null>(CELLS).fill(null);
}

function other(side: Side): Side {
  return side === "you" ? "cpu" : "you";
}

function coord(i: number): string {
  return `${COL_LABEL[i % 3]}${Math.floor(i / 3) + 1}`;
}

/**
 * 완성된 줄을 찾아 그 줄의 마크를 돌려준다. 정석적인 구현이다.
 * 세 칸이 모두 차 있고 서로 같으면 그 마크가 이긴 것이다.
 * 인자로 받는 것은 마크 배열뿐이다. 누가 놓았는지는 들어오지 않는다.
 */
function findWinner(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a] as Mark, line };
    }
  }
  return null;
}

/** 둘 차례인 쪽의 관점에서 본 값. score 1 승 / 0 무 / -1 패, len은 남은 수. */
type Eval = { score: number; len: number };

/** 이길 거면 빨리 이기고, 질 거면 최대한 늦게 진다. */
function better(a: Eval, b: Eval): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.score > 0) return a.len < b.len;
  if (a.score < 0) return a.len > b.len;
  return false;
}

type Stat = { nodes: number };

/** 한 칸 두고 난 뒤의 값. 그 수로 줄이 완성되면 둔 쪽이 이긴 것이다. */
function afterMove(
  board: Cell[],
  i: number,
  memo: Map<string, Eval>,
  stat: Stat,
): Eval {
  board[i] = MARK;
  let result: Eval;
  if (findWinner(board)) {
    result = { score: 1, len: 1 };
  } else {
    const reply = solve(board, memo, stat);
    result = { score: -reply.score, len: reply.len + 1 };
  }
  board[i] = "";
  return result;
}

/** 네가맥스 완전탐색. 9칸이라 끝까지 읽어도 금방 끝난다. */
function solve(board: Cell[], memo: Map<string, Eval>, stat: Stat): Eval {
  const key = board.join("");
  const hit = memo.get(key);
  if (hit) return hit;

  stat.nodes++;

  let best: Eval | null = null;
  for (let i = 0; i < CELLS; i++) {
    if (board[i]) continue;
    const result = afterMove(board, i, memo, stat);
    if (!best || better(result, best)) best = result;
  }

  // 판이 꽉 찼는데 줄이 없으면 무승부. 실제로는 일어나지 않는다.
  const value = best ?? { score: 0, len: 0 };
  memo.set(key, value);
  return value;
}

type Thought = { index: number; score: number; nodes: number };

function think(board: Cell[]): Thought | null {
  const work = [...board];
  const memo = new Map<string, Eval>();
  const stat: Stat = { nodes: 0 };

  let best: Eval | null = null;
  let choices: number[] = [];

  for (let i = 0; i < CELLS; i++) {
    if (work[i]) continue;
    const result = afterMove(work, i, memo, stat);
    if (!best || better(result, best)) {
      best = result;
      choices = [i];
    } else if (result.score === best.score && result.len === best.len) {
      choices.push(i);
    }
  }

  if (!best) return null;
  return {
    index: choices[Math.floor(Math.random() * choices.length)],
    score: best.score,
    nodes: stat.nodes,
  };
}

/** 상대가 자기 형세를 정직하게 말한다. */
function cpuComment(thought: Thought): string {
  const where = `상대가 ${coord(thought.index)}에 O를 뒀습니다.`;
  if (thought.score > 0) return `${where} 이기는 수를 찾았다고 합니다.`;
  if (thought.score < 0) return `${where} 어떻게 둬도 진다고 판단했습니다. 끄는 중입니다.`;
  return `${where} ${thought.nodes}개의 국면을 읽었습니다.`;
}

/** 이긴 줄이 무슨 색으로 채워졌는지 세어 준다. 판정 결과와는 무관하다. */
function lineSummary(line: number[], owners: (Side | null)[]): string {
  const red = line.filter((i) => owners[i] === "you").length;
  const blue = line.length - red;
  if (red === 0) return "이긴 줄은 파란 O 세 개입니다.";
  if (blue === 0) return "이긴 줄은 빨간 O 세 개입니다.";
  return `이긴 줄은 빨간 O ${red}개와 파란 O ${blue}개입니다.`;
}

function winComment(wins: number): string {
  if (wins >= 8) return `O가 ${wins}연승입니다. 상대는 O이고 당신도 O입니다.`;
  if (wins >= 5) return `${wins}판째 O가 이겼습니다. 기록은 정확합니다.`;
  if (wins >= 3) return "또 O입니다. 판정기는 아무 잘못이 없습니다.";
  if (wins === 2) return "이번에도 O의 승리입니다.";
  return "판정기가 같은 마크 세 개를 찾았습니다. 승자는 O입니다.";
}

export default function Game() {
  // 판에는 마크만 담는다. 색은 따로 둔다. 섞이면 판정기가 오염된다.
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [owners, setOwners] = useState<(Side | null)[]>(noOwners);
  const [turn, setTurn] = useState<Side>("you");
  const [winner, setWinner] = useState<{ mark: Mark; line: number[] } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [moves, setMoves] = useState<{ index: number; side: Side }[]>([]);
  const [thought, setThought] = useState<Thought | null>(null);
  const [wins, setWins] = useState(0);

  const over = winner !== null || drawn;
  const thinking = turn === "cpu" && !over;

  function commit(next: Cell[], i: number, side: Side) {
    setBoard(next);
    setOwners((prev) => {
      const copy = [...prev];
      copy[i] = side;
      return copy;
    });
    setMoves((log) => [...log, { index: i, side }]);

    const found = findWinner(next);
    if (found) {
      setWinner(found);
      setWins((w) => w + 1);
      return;
    }
    if (next.every(Boolean)) {
      setDrawn(true);
      return;
    }
    setTurn(other(side));
  }

  function play(i: number) {
    if (over || turn !== "you" || board[i]) return;
    const next = [...board];
    next[i] = MARK;
    setThought(null);
    commit(next, i, "you");
  }

  // 상대 차례. 9칸을 끝까지 읽고 나서 둔다.
  useEffect(() => {
    if (!thinking) return;

    const decision = think(board);
    const id = setTimeout(() => {
      if (!decision) return;
      const next = [...board];
      next[decision.index] = MARK;
      setThought(decision);
      commit(next, decision.index, "cpu");
    }, 420);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking, board]);

  function restart() {
    setBoard(emptyBoard());
    setOwners(noOwners());
    setTurn("you");
    setWinner(null);
    setDrawn(false);
    setMoves([]);
    setThought(null);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm opacity-70">
        가로·세로·대각선으로 같은 마크 세 개를 먼저 만들면 승리합니다. 당신이 선입니다.
      </p>

      {/* 구분용 색. 헷갈리지 마시라고 붙여 둔 것뿐입니다. */}
      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-2">
          <span className={`text-xl font-bold ${INK.you}`}>O</span>
          <span className="opacity-70">당신</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xl font-bold ${INK.cpu}`}>O</span>
          <span className="opacity-70">상대</span>
        </span>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="grid grid-cols-3 gap-[3px] rounded-lg bg-foreground/25 p-[3px]">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => play(i)}
              disabled={!!cell || over || turn !== "you"}
              aria-label={coord(i)}
              className={`flex h-[clamp(64px,20vw,88px)] w-[clamp(64px,20vw,88px)] items-center justify-center rounded-[3px] text-4xl font-bold transition-colors ${
                winner?.line.includes(i) ? "bg-foreground/15" : "bg-background"
              } ${cell ? "" : "enabled:hover:bg-foreground/10"}`}
            >
              <span className={owners[i] ? INK[owners[i] as Side] : undefined}>
                {cell}
              </span>
            </button>
          ))}
        </div>

        {/* 전적. 누가 이겼는지는 판정기가 말해 주는 대로만 적는다. */}
        <div className="w-full sm:w-40">
          <dl className="flex flex-row flex-wrap gap-x-6 gap-y-3 text-sm sm:flex-col">
            <div>
              <dt className="text-xs opacity-60">차례</dt>
              <dd className="font-bold">
                {over ? (
                  "—"
                ) : (
                  <>
                    {SIDE_NAME[turn]} <span className={INK[turn]}>(O)</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">당신</dt>
              <dd className="font-bold tabular-nums">0승</dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">상대</dt>
              <dd className="font-bold tabular-nums">0승</dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">O</dt>
              <dd className="font-bold tabular-nums">{wins}승</dd>
            </div>
          </dl>

          {moves.length > 0 && (
            <div className="mt-4">
              <p className="text-xs opacity-60">기보</p>
              <p className="mt-1 font-mono text-xs leading-5">
                {moves.map((move, n) => (
                  <span key={move.index}>
                    {n > 0 && <span className="opacity-40"> · </span>}
                    <span className={INK[move.side]}>O</span>
                    <span className="opacity-80">{coord(move.index)}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[52px] text-center">
        {winner ? (
          <>
            {/* 판정기가 아는 것은 마크뿐이라 여기에는 색이 없다. */}
            <p className="text-2xl font-bold">{winner.mark} 승리</p>
            <p className="mt-1 text-sm opacity-60">{winComment(wins)}</p>
            <p className="mt-1 text-sm opacity-60">
              {lineSummary(winner.line, owners)}
            </p>
          </>
        ) : drawn ? (
          <p className="text-2xl font-bold">무승부</p>
        ) : thinking ? (
          <p className="text-sm opacity-60">상대가 수를 읽고 있습니다…</p>
        ) : thought ? (
          <p className="text-sm opacity-60">{cpuComment(thought)}</p>
        ) : (
          <p className="text-sm opacity-60">
            O를 놓으십시오. 상대도 O를 놓습니다. 색만 다릅니다.
          </p>
        )}
      </div>

      <button
        onClick={restart}
        className="rounded-full border border-foreground/20 px-6 py-3 text-sm hover:bg-foreground/10"
      >
        다시 하기
      </button>

      <p className="max-w-md text-center text-xs opacity-50">
        상대는 9칸을 끝까지 읽는 완전탐색으로 둡니다. 이길 수 있으면 가장 빨리 이기고,
        질 수밖에 없으면 가장 오래 버팁니다. 승자 판정기에는 색이 전달되지 않습니다.
      </p>
    </div>
  );
}
