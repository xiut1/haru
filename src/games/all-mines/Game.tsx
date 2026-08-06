"use client";

import { useEffect, useReducer, useState } from "react";

/**
 * 지뢰찾기 규칙은 전부 지킨다. 뺀 것은 «지뢰가 아닌 칸»이다.
 *
 * 첫 클릭 안전, 인접 지뢰 수, 0칸 자동 확장, 깃발, 양쪽 열기(chord),
 * 남은 지뢰 카운터, 승리 판정 — 전부 진짜 구현이고 진짜로 돈다.
 * 조건이 성립하지 않을 뿐이다.
 */

type LevelKey = "beginner" | "intermediate" | "expert";

type Level = {
  key: LevelKey;
  label: string;
  cols: number;
  rows: number;
  /** 칸 한 변의 px. 고급은 좁아서 가로로 스크롤된다. 원본도 그랬다. */
  cell: number;
  font: string;
};

/** 원본의 난이도 3종. 지뢰 수만 칸 수와 같게 맞췄다. */
const LEVELS: Level[] = [
  { key: "beginner", label: "초급", cols: 9, rows: 9, cell: 32, font: "text-base" },
  { key: "intermediate", label: "중급", cols: 16, rows: 16, cell: 26, font: "text-sm" },
  { key: "expert", label: "고급", cols: 30, rows: 16, cell: 22, font: "text-[11px]" },
];

function level(key: LevelKey): Level {
  return LEVELS.find((l) => l.key === key)!;
}

const total = (l: Level) => l.cols * l.rows;
/** 지뢰 수. 정직하게 칸 수만큼 깐다. */
const mineCount = (l: Level) => total(l);

type Cell = {
  mine: boolean;
  /** 인접 지뢰 수. 가장자리면 5, 모서리면 3이 된다. 정직한 계산이다. */
  adj: number;
  revealed: boolean;
  flagged: boolean;
  /** 첫 클릭 안전 규칙으로 해제된 칸. 주변 계산에는 여전히 지뢰로 센다. */
  defused: boolean;
};

const NUMBER_COLOR: Record<number, string> = {
  1: "#2563eb",
  2: "#15803d",
  3: "#dc2626",
  4: "#1e3a8a",
  5: "#7f1d1d",
  6: "#0e7490",
  7: "#171717",
  8: "#525252",
};

function neighbors(i: number, l: Level): number[] {
  const x = i % l.cols;
  const y = Math.floor(i / l.cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= l.cols || ny < 0 || ny >= l.rows) continue;
      out.push(ny * l.cols + nx);
    }
  }
  return out;
}

/** 지뢰를 mineCount개 깐다. 뽑기 방식은 정석이다. 뽑을 칸이 그것뿐일 뿐이다. */
function layMines(l: Level): boolean[] {
  const mines = Array<boolean>(total(l)).fill(false);
  let placed = 0;
  while (placed < mineCount(l)) {
    const i = Math.floor(Math.random() * total(l));
    if (mines[i]) continue;
    mines[i] = true;
    placed += 1;
  }
  return mines;
}

function buildBoard(l: Level): Cell[] {
  const mines = layMines(l);
  return mines.map((mine, i) => ({
    mine,
    adj: neighbors(i, l).filter((n) => mines[n]).length,
    revealed: false,
    flagged: false,
    defused: false,
  }));
}

type Status = "ready" | "playing" | "dead" | "won";

type State = {
  level: LevelKey;
  board: Cell[];
  status: Status;
  /** 첫 클릭 안전 규칙을 아직 쓰지 않았는가 */
  firstClick: boolean;
  /** 첫 클릭에서 지뢰를 옮길 빈 칸을 찾아본 횟수 */
  relocations: number;
  clicks: number;
  /** 양쪽 열기가 조건을 만족해 발동한 횟수 */
  chords: number;
  deaths: number;
};

function initial(key: LevelKey = "beginner", deaths = 0): State {
  return {
    level: key,
    board: buildBoard(level(key)),
    status: "ready",
    firstClick: true,
    relocations: 0,
    clicks: 0,
    chords: 0,
    deaths,
  };
}

/**
 * 표준 «첫 클릭은 안전» 처리.
 * 첫 칸에 지뢰가 있으면 지뢰 없는 칸을 찾아 그리로 옮긴다.
 * 찾는 코드는 아래 그대로 있다. 매번 못 찾을 뿐이다.
 * 못 찾으면 규칙 원문대로 «첫 클릭은 터지지 않는다»만 지킨다.
 */
function relocateFirstMine(board: Cell[], at: number, l: Level): Cell[] | null {
  const free = board.findIndex((c, i) => !c.mine && i !== at);
  if (free === -1) return null;

  const moved = board.map((c) => ({ ...c }));
  moved[at].mine = false;
  moved[free].mine = true;
  return moved.map((c, i) => ({
    ...c,
    adj: neighbors(i, l).filter((n) => moved[n].mine).length,
  }));
}

/** 0칸이면 주변을 자동으로 연다. 재귀 구현은 정상이다. 0칸이 안 나올 뿐이다. */
function floodReveal(board: Cell[], start: number, l: Level): Cell[] {
  const next = board.map((c) => ({ ...c }));
  const stack = [start];

  while (stack.length > 0) {
    const i = stack.pop()!;
    const cell = next[i];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adj === 0) stack.push(...neighbors(i, l));
  }
  return next;
}

/** 승리 판정: 지뢰가 아닌 칸을 전부 열었는가. 칸을 열 때마다 정직하게 돈다. */
function settle(board: Cell[], l: Level): Status {
  const opened = board.filter((c) => c.revealed).length;
  return opened === total(l) - mineCount(l) ? "won" : "playing";
}

function blowUp(s: State, board: Cell[]): State {
  return {
    ...s,
    board: board.map((c) => (c.mine ? { ...c, revealed: true } : c)),
    clicks: s.clicks + 1,
    deaths: s.deaths + 1,
    status: "dead",
  };
}

type Action =
  | { type: "reveal"; at: number }
  | { type: "flag"; at: number }
  | { type: "restart" }
  | { type: "level"; level: LevelKey };

function reducer(s: State, action: Action): State {
  if (action.type === "level") return initial(action.level, s.deaths);
  if (action.type === "restart") return initial(s.level, s.deaths);
  if (s.status === "dead" || s.status === "won") return s;

  const l = level(s.level);
  const cell = s.board[action.at];

  if (action.type === "flag") {
    const board = s.board.map((c, i) =>
      i === action.at && !c.revealed ? { ...c, flagged: !c.flagged } : c,
    );
    return { ...s, board, status: "playing" };
  }

  /**
   * 표준 «양쪽 열기». 열린 숫자 칸을 다시 누르면,
   * 주변 깃발 수가 숫자와 같을 때에 한해 나머지 인접 칸을 전부 연다.
   * 깃발이 틀렸으면 그대로 터진다 — 아래 분기도 진짜로 살아 있다.
   * 다만 이 판에서는 조건이 맞는 순간 열 칸이 이미 0개다.
   */
  if (cell.revealed) {
    if (cell.adj === 0) return s;
    const ns = neighbors(action.at, l);
    const flagged = ns.filter((n) => s.board[n].flagged).length;
    if (flagged !== cell.adj) return s;

    const targets = ns.filter(
      (n) => !s.board[n].flagged && !s.board[n].revealed,
    );
    if (targets.length === 0) return { ...s, chords: s.chords + 1 };
    if (targets.some((n) => s.board[n].mine)) return blowUp(s, s.board);

    let board = s.board;
    for (const t of targets) board = floodReveal(board, t, l);
    return { ...s, board, chords: s.chords + 1, status: settle(board, l) };
  }

  if (cell.flagged) return s;

  // 첫 클릭
  if (s.firstClick) {
    const relocated = relocateFirstMine(s.board, action.at, l);
    // 옮길 데가 없으면 그 자리에서 해제한다. 규칙은 «첫 클릭은 터지지 않는다»니까.
    const base = (relocated ?? s.board).map((c, i) =>
      i === action.at ? { ...c, defused: c.mine } : c,
    );
    const board = floodReveal(base, action.at, l);

    return {
      ...s,
      board,
      firstClick: false,
      relocations: relocated ? s.relocations + 1 : s.relocations,
      clicks: s.clicks + 1,
      status: settle(board, l),
    };
  }

  if (cell.mine) return blowUp(s, s.board);

  const board = floodReveal(s.board, action.at, l);
  return { ...s, board, clicks: s.clicks + 1, status: settle(board, l) };
}

/** 죽은 횟수별로 점점 무례해지는 코멘트 */
function deathComment(deaths: number): string {
  if (deaths >= 20) return "20번째입니다. 다음 칸도 지뢰입니다. 미리 말씀드립니다.";
  if (deaths >= 10) return "10번 죽으셨습니다. 첫 칸의 숫자는 처음부터 정확했습니다.";
  if (deaths >= 5) return "다른 자리를 고르셔도 결과는 같습니다.";
  if (deaths >= 2) return "숫자 8은 «주변 여덟 칸이 전부 지뢰»라는 뜻입니다.";
  return "지뢰를 밟으셨습니다.";
}

/** 깃발을 꽂을수록 남은 칸을 세어 준다. 세는 것 말고는 해 줄 게 없다. */
function flagComment(flags: number, mines: number): string {
  const left = mines - flags;
  const ratio = flags / mines;
  if (ratio >= 0.9)
    return `${left}칸 남았습니다. 다 꽂으셔도 승리 조건과는 무관합니다.`;
  if (ratio >= 0.5) return `절반을 넘기셨습니다. ${left}칸 남았습니다.`;
  if (ratio >= 0.25)
    return `${flags}칸을 표시하셨습니다. ${left}칸 남았습니다. 전부 맞습니다.`;
  return `깃발 ${flags}개. ${left}칸 남았습니다.`;
}

function Face({ status, stuck }: { status: Status; stuck: boolean }) {
  if (status === "dead") return <span>😵</span>;
  if (status === "won") return <span>😎</span>;
  if (stuck) return <span>😐</span>;
  return <span>🙂</span>;
}

export default function Game() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial());
  const [flagMode, setFlagMode] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const l = level(state.level);
  const MINES = mineCount(l);
  const TOTAL = total(l);

  const running = state.status === "playing";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((t) => Math.min(t + 1, 999)), 1000);
    return () => clearInterval(id);
  }, [running]);

  function restart() {
    dispatch({ type: "restart" });
    setSeconds(0);
  }

  function changeLevel(key: LevelKey) {
    dispatch({ type: "level", level: key });
    setSeconds(0);
  }

  function press(i: number) {
    // 열린 칸은 깃발 모드와 무관하게 «양쪽 열기»로 간다. 원본과 같다.
    if (flagMode && !state.board[i].revealed) dispatch({ type: "flag", at: i });
    else dispatch({ type: "reveal", at: i });
  }

  const flags = state.board.filter((c) => c.flagged).length;
  const opened = state.board.filter((c) => c.revealed).length;
  const remaining = Math.max(MINES - flags, 0);
  /** 남은 칸이 전부 깃발이라 더 열 수 있는 칸이 없는 상태. */
  const stuck =
    state.status === "playing" &&
    state.board.every((c) => c.revealed || c.flagged);
  const done = state.status === "dead" || state.status === "won";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 난이도. 어느 쪽을 고르셔도 지뢰 밀도는 100%입니다. */}
      <div className="flex gap-2">
        {LEVELS.map((lv) => (
          <button
            key={lv.key}
            onClick={() => changeLevel(lv.key)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              lv.key === state.level
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 hover:bg-foreground/10"
            }`}
          >
            {lv.label}
          </button>
        ))}
      </div>

      <p className="text-sm opacity-70">
        {l.label} · {l.cols}×{l.rows} · 지뢰 {MINES}개
      </p>

      {/* 상단 패널 */}
      <div className="flex w-full max-w-[320px] items-center justify-between rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2">
        <span className="font-mono text-xl font-bold tabular-nums text-red-600">
          {String(remaining).padStart(3, "0")}
        </span>
        <button
          onClick={restart}
          className="text-2xl transition hover:scale-110"
          aria-label="다시 시작"
        >
          <Face status={state.status} stuck={stuck} />
        </button>
        <span className="font-mono text-xl font-bold tabular-nums text-red-600">
          {String(seconds).padStart(3, "0")}
        </span>
      </div>

      {/* 판. 고급은 가로로 넘친다. */}
      <div className="w-full max-w-full overflow-x-auto">
        <div
          className="mx-auto grid w-fit gap-[2px] rounded-lg border border-foreground/20 bg-foreground/10 p-[3px]"
          style={{ gridTemplateColumns: `repeat(${l.cols}, ${l.cell}px)` }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {state.board.map((cell, i) => {
            const boom = cell.revealed && cell.mine && !cell.defused;
            return (
              <button
                key={i}
                onClick={() => press(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  dispatch({ type: "flag", at: i });
                }}
                disabled={done}
                style={{
                  width: l.cell,
                  height: l.cell,
                  color:
                    cell.revealed && !boom && cell.adj > 0
                      ? NUMBER_COLOR[cell.adj]
                      : undefined,
                }}
                aria-label={
                  cell.revealed
                    ? boom
                      ? "지뢰"
                      : `${cell.adj}`
                    : cell.flagged
                      ? "깃발"
                      : "닫힌 칸"
                }
                className={`flex items-center justify-center rounded-[3px] font-bold leading-none ${l.font} ${
                  cell.revealed
                    ? boom
                      ? "bg-red-500/70"
                      : "bg-foreground/[0.07]"
                    : "bg-foreground/25 hover:bg-foreground/35"
                }`}
              >
                {cell.revealed
                  ? boom
                    ? "💣"
                    : cell.adj > 0
                      ? cell.adj
                      : ""
                  : cell.flagged
                    ? "🚩"
                    : ""}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setFlagMode((v) => !v)}
        className={`rounded-full border px-5 py-2 text-sm transition ${
          flagMode
            ? "border-foreground bg-foreground text-background"
            : "border-foreground/20 hover:bg-foreground/10"
        }`}
      >
        🚩 깃발 모드 {flagMode ? "켜짐" : "꺼짐"}
      </button>

      <div className="min-h-[72px] max-w-md text-center">
        {state.status === "ready" && (
          <p className="text-sm opacity-60">
            아무 칸이나 누르십시오. 첫 클릭은 안전합니다.
          </p>
        )}

        {stuck && (
          <>
            <p className="text-2xl font-bold">교착</p>
            {opened === 0 ? (
              <p className="mt-1 text-sm opacity-60">
                한 칸도 열지 않고 {flags}칸을 전부 표시하셨습니다. 지뢰가 아닌
                칸은 0개이고 여신 칸도 0개이므로, 승리 조건은 지금 성립합니다.
                다만 승리 판정은 칸을 열 때 돌아갑니다. 한 칸이라도 여시는
                순간 성립하지 않습니다.
              </p>
            ) : (
              <p className="mt-1 text-sm opacity-60">
                열 수 있는 칸이 없습니다. 깃발 {flags}개, 남은 지뢰 표시는{" "}
                {String(remaining).padStart(3, "0")}. 첫 칸의 지뢰는 해제됐을
                뿐 여전히 지뢰라 끝까지 안 내려갑니다. 지뢰가 아닌 칸은 0개인데
                이미 {opened}개를 여셨으므로 판정은 불일치입니다.
              </p>
            )}
          </>
        )}

        {state.status === "playing" && !stuck && (
          <>
            <p className="text-sm opacity-60">
              열린 칸 {opened} / {TOTAL - MINES}. 나머지는 지뢰입니다.
            </p>
            {flags > 0 && (
              <p className="mt-1 text-sm opacity-60">
                {flagComment(flags, MINES)}
              </p>
            )}
            {state.chords > 0 && (
              <p className="mt-1 text-sm opacity-60">
                양쪽 열기가 {state.chords}번 발동했습니다. 그때마다 열린 칸은
                0개였습니다.
              </p>
            )}
          </>
        )}

        {state.status === "dead" && (
          <>
            <p className="text-2xl font-bold">실패</p>
            <p className="mt-1 text-sm opacity-60">
              {deathComment(state.deaths)}
            </p>
          </>
        )}

        {state.status === "won" && <p className="text-2xl font-bold">클리어</p>}
      </div>

      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-center text-sm">
        <div>
          <dt className="opacity-60">누른 칸</dt>
          <dd className="text-xl font-bold tabular-nums">{state.clicks}</dd>
        </div>
        <div>
          <dt className="opacity-60">밟은 지뢰</dt>
          <dd className="text-xl font-bold tabular-nums">{state.deaths}</dd>
        </div>
        <div>
          <dt className="opacity-60">양쪽 열기</dt>
          <dd className="text-xl font-bold tabular-nums">{state.chords}</dd>
        </div>
        <div>
          <dt className="opacity-60">지뢰 이동</dt>
          <dd className="text-xl font-bold tabular-nums">{state.relocations}</dd>
        </div>
      </dl>

      <p className="max-w-md text-center text-xs opacity-50">
        좌클릭으로 열고, 우클릭(또는 깃발 모드)으로 표시합니다. 열린 숫자 칸을
        다시 누르면 표준 규칙대로 «양쪽 열기»가 작동하며, 주변 깃발 수가 숫자와
        같을 때만 발동합니다. 이때 열리는 칸은 0개입니다. 숫자는 주변 여덟 칸의
        지뢰 수이며, 가장자리에서는 5, 모서리에서는 3이 나옵니다.
      </p>
    </div>
  );
}
