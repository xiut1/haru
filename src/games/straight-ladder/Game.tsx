"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 사다리 타기 규칙은 전부 지킨다. 세로줄 위에서 출발해 한 행씩 내려가면서
 * 왼쪽 가로선이 있으면 왼쪽으로, 오른쪽에 있으면 오른쪽으로 건너간다.
 * 가로선 생성기도 원본 규칙(같은 행에서 가로선끼리 붙지 않게)을 지킨다.
 *
 * 뺀 것은 가로선 밀도 하나뿐이다. 미리보기는 PREVIEW_DENSITY로 성실하게
 * 계속 다시 뽑아서 진짜 사다리처럼 보이지만, 시작을 누르는 순간 확정되는
 * 사다리는 RUNG_DENSITY로 뽑는다. 그 값이 0이라 가로선이 한 개도 안 남는다.
 * 그래서 경로는 항상 항등 사상이고, 결과는 고르기 전에 이미 읽을 수 있다.
 */
const ROWS = 28;

/** 확정 사다리의 가로선 밀도. 원본 사다리는 0.35쯤 쓴다. */
const RUNG_DENSITY = 0;

/** 가림막 안에서 굴러가는 미리보기 밀도. 이쪽은 진짜로 뽑힌다. */
const PREVIEW_DENSITY = 0.14;

/** 한 행 내려가는 데 걸리는 시간 */
const STEP_MS = 38;
/** 미리보기를 다시 뽑는 주기 */
const PREVIEW_MS = 260;
/** 가림막이 걷히는 데 걸리는 시간 */
const REVEAL_MS = 800;

const MIN_COLS = 2;
const MAX_COLS = 8;

const DEFAULT_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DEFAULT_PRIZES = ["당첨", "꽝", "꽝", "꽝", "꽝", "꽝", "꽝", "꽝"];

/** rungs[행][간격] — 간격 g는 세로줄 g와 g+1 사이를 뜻한다. */
type Rungs = boolean[][];

/**
 * 가로선을 뽑는다. 같은 행에서 가로선이 연달아 붙으면 경로가 갈라지므로
 * 원본 규칙대로 바로 왼쪽 간격이 이미 찼으면 건너뛴다.
 */
function generateRungs(cols: number, density: number): Rungs {
  const rungs: Rungs = [];
  for (let r = 0; r < ROWS; r++) {
    const row = Array<boolean>(cols - 1).fill(false);
    for (let g = 0; g < row.length; g++) {
      if (g > 0 && row[g - 1]) continue;
      if (Math.random() < density) row[g] = true;
    }
    rungs.push(row);
  }
  return rungs;
}

function emptyRungs(cols: number): Rungs {
  return Array.from({ length: ROWS }, () => Array<boolean>(cols - 1).fill(false));
}

type Step = {
  /** 이 행에 들어올 때의 세로줄 */
  from: number;
  /** 가로선을 타고 난 뒤의 세로줄 */
  to: number;
  /** -1 왼쪽, 0 직진, 1 오른쪽 */
  move: -1 | 0 | 1;
  /** 이 행에서 좌·우 가로선을 확인한 결과 */
  left: boolean;
  right: boolean;
};

/** 한 행씩 내려가면서 좌우 가로선을 확인한다. 사다리 타기의 전부다. */
function walk(rungs: Rungs, start: number): Step[] {
  const steps: Step[] = [];
  let col = start;
  for (let r = 0; r < ROWS; r++) {
    const left = col > 0 && rungs[r][col - 1];
    const right = col < rungs[r].length && rungs[r][col];
    const move: -1 | 0 | 1 = left ? -1 : right ? 1 : 0;
    steps.push({ from: col, to: col + move, move, left, right });
    col += move;
  }
  return steps;
}

function countRungs(rungs: Rungs, cols: number): number {
  return rungs.reduce(
    (sum, row) => sum + row.slice(0, cols - 1).filter(Boolean).length,
    0,
  );
}

/** 위아래 칸 사이 간격(px). Tailwind gap-1과 같은 값이어야 한다. */
const GAP = 4;

/** 세로줄 c의 가로 위치. 위아래 입력칸의 중앙과 정확히 맞춘다. */
function colLeft(c: number, cols: number): string {
  return `calc((100% - ${(cols - 1) * GAP}px) / ${cols} * ${c + 0.5} + ${c * GAP}px)`;
}

/** 세로줄 하나에서 옆 세로줄까지의 거리 = 가로선 한 개의 길이 */
function colSpan(cols: number): string {
  return `calc((100% - ${(cols - 1) * GAP}px) / ${cols} + ${GAP}px)`;
}

/** 판 위아래로 남기는 여백(%). 도착한 말이 테두리에 잘리지 않게 한다. */
const PAD = 4;

function rowTop(r: number): number {
  return PAD + (r / ROWS) * (100 - PAD * 2);
}

/** 한 행짜리 세로 구간의 높이(%) */
const ROW_H = (100 - PAD * 2) / ROWS;

function logLine(index: number, step: Step): string {
  const dir = step.move === 0 ? "직진" : step.move < 0 ? "← 좌로 건넘" : "우로 건넘 →";
  const left = step.left ? "좌 있음" : "좌 없음";
  const right = step.right ? "우 있음" : "우 없음";
  return `${String(index + 1).padStart(2, "0")}행  ${left} · ${right} → ${dir}`;
}

function verdict(plays: number, name: string, prize: string, win: boolean): string {
  if (win && plays === 1) return `축하합니다. 당첨 자리를 직접 고르셨습니다.`;
  if (win) return `또 당첨입니다. 당첨 자리를 누르면 당첨이 나옵니다.`;
  if (plays >= 8) return `${plays}번째입니다. 사다리는 아주 잘 작동하고 있습니다.`;
  if (plays >= 5) return `${plays}번째입니다. 이제 그냥 아래를 보고 고르시죠.`;
  if (plays === 4) return "네 번 다 직진했습니다. 뭔가 눈치채셨을 텐데요.";
  if (plays === 3) return "세 번째도 고른 자리 그대로입니다.";
  if (plays === 2) return "두 번째도 바로 밑으로 떨어졌습니다.";
  return `${name} 바로 아래에 있던 「${prize}」입니다. 놀라셨습니까.`;
}

export default function Game() {
  const [cols, setCols] = useState(5);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [prizes, setPrizes] = useState<string[]>(DEFAULT_PRIZES);
  /** 당첨 자리. 칸에 뭐라고 적혀 있든 여기 적힌 자리가 당첨이다. */
  const [winner, setWinner] = useState(0);

  const [started, setStarted] = useState(false);
  const [revealing, setRevealing] = useState(false);

  /** 시작을 누르는 순간 확정되는 진짜 사다리 */
  const [rungs, setRungs] = useState<Rungs>(() => generateRungs(MAX_COLS, RUNG_DENSITY));
  /** 가림막 안에서 계속 다시 뽑히는 미리보기. 서버와 어긋나지 않게 빈 판에서 시작한다. */
  const [preview, setPreview] = useState<Rungs>(() => emptyRungs(MAX_COLS));

  const [picked, setPicked] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  const [plays, setPlays] = useState(0);

  const logRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(
    () => (picked === null ? null : walk(rungs, picked)),
    [rungs, picked],
  );

  const running = started && steps !== null && row < ROWS;
  const done = started && steps !== null && row >= ROWS;
  const current = steps ? (row === 0 ? steps[0].from : steps[row - 1].to) : null;
  const crossed = steps ? steps.slice(0, row).filter((s) => s.move !== 0).length : 0;
  const locked = started || running;

  // 한 행씩 내려간다. 연출이 아니라 실제로 경로를 한 칸씩 따라간다.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRow((r) => Math.min(r + 1, ROWS)), STEP_MS);
    return () => clearInterval(id);
  }, [running]);

  // 가림막이 덮여 있는 동안에는 미리보기 사다리를 계속 새로 뽑는다.
  useEffect(() => {
    if (started) return;
    const id = setInterval(
      () => setPreview(generateRungs(MAX_COLS, PREVIEW_DENSITY)),
      PREVIEW_MS,
    );
    return () => clearInterval(id);
  }, [started]);

  // 가림막이 다 걷힐 때까지는 아무도 못 고르게 한다.
  useEffect(() => {
    if (!revealing) return;
    const id = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(id);
  }, [revealing]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [row]);

  function start() {
    // 여기서 진짜 사다리가 확정된다. 밀도만 다를 뿐 뽑는 방식은 미리보기와 같다.
    setRungs(generateRungs(MAX_COLS, RUNG_DENSITY));
    setStarted(true);
    setRevealing(true);
    setPicked(null);
    setRow(0);
  }

  function pick(c: number) {
    if (!started || revealing || running) return;
    setPicked(c);
    setRow(0);
    setPlays((p) => p + 1);
  }

  function again() {
    setPicked(null);
    setRow(0);
  }

  function reset() {
    setStarted(false);
    setRevealing(false);
    setPicked(null);
    setRow(0);
  }

  function editName(c: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === c ? value : n)));
  }

  function editPrize(c: number, value: string) {
    setPrizes((prev) => prev.map((p, i) => (i === c ? value : p)));
  }

  /** 당첨 자리는 하나뿐이다. 원본 사다리와 같다. */
  function markWin(c: number) {
    setWinner(c);
  }

  /** 결과를 섞는다. 당첨 자리도 같이 따라간다. */
  function shufflePrizes() {
    const order = Array.from({ length: cols }, (_, i) => i);
    for (let i = cols - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setPrizes((prev) => prev.map((p, i) => (i < cols ? prev[order[i]] : p)));
    const moved = order.indexOf(winner);
    if (moved >= 0) setWinner(moved);
  }

  const seats = Array.from({ length: cols }, (_, i) => i);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="text-center text-sm opacity-70">
        {started
          ? "참가자를 누르면 확정된 사다리를 타고 내려갑니다."
          : "참가자와 결과를 적고 시작을 누르십시오. 가림막이 걷히면 사다리가 확정됩니다."}
      </p>

      {/* 설정 */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="opacity-60">인원</span>
          {Array.from({ length: MAX_COLS - MIN_COLS + 1 }, (_, i) => i + MIN_COLS).map(
            (n) => (
              <button
                key={n}
                onClick={() => {
                  setCols(n);
                  if (winner >= n) setWinner(0);
                }}
                disabled={locked}
                className={`h-8 w-8 rounded-full border text-xs tabular-nums transition-all ${
                  n === cols
                    ? "border-foreground/60 bg-foreground/10 font-bold"
                    : "border-foreground/20 opacity-50 enabled:hover:-translate-y-0.5 enabled:hover:bg-foreground/10 enabled:hover:opacity-100"
                } disabled:opacity-30`}
              >
                {n}
              </button>
            ),
          )}
        </div>
        <button
          onClick={shufflePrizes}
          disabled={locked}
          className="rounded-full border border-foreground/20 px-4 py-1.5 text-xs transition-all enabled:hover:-translate-y-0.5 enabled:hover:bg-foreground/10 disabled:opacity-30"
        >
          결과 섞기
        </button>
      </div>

      {/* 사다리 */}
      <div className="w-full rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-3 shadow-sm sm:p-4">
        {/* 참가자 */}
        <div className="flex gap-1">
          {seats.map((c) =>
            started ? (
              <button
                key={c}
                onClick={() => pick(c)}
                disabled={revealing || running}
                className={`min-w-0 flex-1 truncate rounded-lg border px-1 py-2 text-center text-sm font-bold transition-all ${
                  picked === c
                    ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_18px_-6px_rgb(16_185_129)]"
                    : "border-foreground/15 enabled:hover:-translate-y-0.5 enabled:hover:border-foreground/40 enabled:hover:bg-foreground/5"
                } disabled:opacity-60`}
              >
                {names[c] || "?"}
              </button>
            ) : (
              <input
                key={c}
                value={names[c]}
                onChange={(e) => editName(c, e.target.value)}
                maxLength={6}
                aria-label={`참가자 ${c + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-1 py-2 text-center text-sm font-bold outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/5"
              />
            ),
          )}
        </div>

        {/* 판 */}
        <div className="relative mt-2 h-[clamp(220px,42vh,320px)] overflow-hidden rounded-lg bg-foreground/[0.03]">
          {/* 확정된 세로줄. 가림막이 걷히면 위에서부터 자라난다. */}
          {seats.map((c) => (
            <div
              key={c}
              className="absolute top-0 w-px -translate-x-1/2 bg-foreground/30 transition-[height] duration-500 ease-out"
              style={{
                left: colLeft(c, cols),
                height: started ? "100%" : "0%",
                transitionDelay: started ? `${c * 55}ms` : "0ms",
              }}
            />
          ))}

          {/* 확정된 가로선. 생성기가 뽑아낸 만큼 그린다. */}
          {rungs.flatMap((line, r) =>
            line.slice(0, cols - 1).map((on, g) =>
              on ? (
                <div
                  key={`${r}-${g}`}
                  className="absolute h-px -translate-y-1/2 bg-foreground/40"
                  style={{
                    top: `${rowTop(r)}%`,
                    left: colLeft(g, cols),
                    width: colSpan(cols),
                  }}
                />
              ) : null,
            ),
          )}

          {/* 지나온 경로. 가로선을 탔다면 꺾인 자국이 남는다. */}
          {steps?.slice(0, row).map((step, r) => (
            <div key={r}>
              {step.move !== 0 && (
                <div
                  className="absolute h-[3px] -translate-y-1/2 rounded-full bg-emerald-500"
                  style={{
                    top: `${rowTop(r)}%`,
                    left: colLeft(Math.min(step.from, step.to), cols),
                    width: colSpan(cols),
                  }}
                />
              )}
              <div
                className="absolute w-[3px] -translate-x-1/2 rounded-full bg-emerald-500 shadow-[0_0_10px_-2px_rgb(16_185_129)]"
                style={{
                  top: r === 0 ? "0%" : `${rowTop(r)}%`,
                  left: colLeft(step.to, cols),
                  height: `${(r === 0 ? PAD + ROW_H : ROW_H) + 0.4}%`,
                }}
              />
            </div>
          ))}

          {/* 지금 위치 */}
          {started && current !== null && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 ease-linear transition-[top,left] duration-[38ms]"
              style={{ top: `${rowTop(row)}%`, left: colLeft(current, cols) }}
            >
              {done && (
                <span
                  className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full ${
                    winner === current ? "bg-amber-500/40" : "bg-emerald-500/40"
                  }`}
                />
              )}
              <span
                className={`relative block h-3.5 w-3.5 rounded-full transition-colors ${
                  done && winner === current
                    ? "bg-amber-500 shadow-[0_0_14px_2px_rgb(245_158_11_/_0.7)]"
                    : "bg-emerald-500 shadow-[0_0_14px_2px_rgb(16_185_129_/_0.7)]"
                }`}
              />
            </div>
          )}

          {/* 가림막. 안에서는 미리보기 사다리가 계속 다시 뽑히고 있다. */}
          <div
            className={`absolute inset-0 z-20 overflow-hidden bg-background transition-[clip-path] duration-700 ease-in-out ${
              started ? "pointer-events-none" : ""
            }`}
            style={{ clipPath: started ? "inset(100% 0 0 0)" : "inset(0 0 0 0)" }}
          >
            <div className="absolute inset-0 bg-foreground/[0.04]" />

            {seats.map((c) => (
              <div
                key={c}
                className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-foreground/30"
                style={{ left: colLeft(c, cols) }}
              />
            ))}

            {/* 미리보기 가로선. 매번 다시 뽑히면서 흐릿하게 갈아 끼워진다. */}
            {preview.flatMap((line, r) =>
              line.slice(0, Math.max(cols - 1, 0)).map((on, g) => (
                <div
                  key={`${r}-${g}`}
                  className={`absolute h-[2px] -translate-y-1/2 rounded-full bg-foreground/45 transition-opacity duration-200 ${
                    on ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    top: `${rowTop(r)}%`,
                    left: colLeft(g, cols),
                    width: colSpan(cols),
                  }}
                />
              )),
            )}

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/15 bg-background/90 px-4 py-1.5 text-xs shadow-sm">
              <span className="animate-pulse">사다리를 섞는 중입니다…</span>
            </div>
          </div>
        </div>

        {/* 결과 */}
        <div className="mt-2 flex gap-1">
          {seats.map((c) => {
            const win = winner === c;
            const arrived = done && current === c;
            return started ? (
              <div
                key={c}
                className={`min-w-0 flex-1 truncate rounded-lg border px-1 py-2 text-center text-sm transition-all duration-300 ${
                  arrived
                    ? `scale-[1.04] font-bold ${
                        win
                          ? "border-amber-500 bg-amber-500/15 shadow-[0_0_22px_-6px_rgb(245_158_11)]"
                          : "border-emerald-500 bg-emerald-500/15 shadow-[0_0_22px_-6px_rgb(16_185_129)]"
                      }`
                    : win
                      ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                      : "border-foreground/15 opacity-60"
                }`}
              >
                {prizes[c] || "—"}
              </div>
            ) : (
              <input
                key={c}
                value={prizes[c]}
                onChange={(e) => editPrize(c, e.target.value)}
                maxLength={6}
                aria-label={`결과 ${c + 1}`}
                className={`min-w-0 flex-1 rounded-lg border bg-background px-1 py-2 text-center text-sm outline-none transition-colors focus:bg-foreground/5 ${
                  win
                    ? "border-amber-500/50 font-bold text-amber-600 focus:border-amber-500 dark:text-amber-400"
                    : "border-foreground/15 focus:border-foreground/50"
                }`}
              />
            );
          })}
        </div>

        {/* 당첨 지정 */}
        {!started && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs">
            <span className="mr-1 opacity-50">당첨 지정</span>
            {seats.map((c) => (
              <button
                key={c}
                onClick={() => markWin(c)}
                aria-label={`${c + 1}번 자리를 당첨으로 지정`}
                className={`h-5 w-5 rounded-full border transition-all hover:scale-110 ${
                  winner === c
                    ? "border-amber-500 bg-amber-500/70"
                    : "border-foreground/25 hover:border-foreground/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 계기판 */}
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-xs opacity-60">상태</dt>
          <dd className="font-bold">{started ? "확정됨" : "섞는 중"}</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">미리보기 가로선</dt>
          <dd className="font-bold tabular-nums">
            {started ? "—" : `${countRungs(preview, cols)}개`}
          </dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">확정된 가로선</dt>
          <dd className="font-bold tabular-nums">
            {started ? `${countRungs(rungs, cols)}개` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">사다리 높이</dt>
          <dd className="font-bold tabular-nums">{ROWS}행</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">검사한 교차점</dt>
          <dd className="font-bold tabular-nums">{row * 2}개</dd>
        </div>
        <div>
          <dt className="text-xs opacity-60">좌우 이동</dt>
          <dd className="font-bold tabular-nums">{crossed}칸</dd>
        </div>
      </dl>

      {/* 경로 추적 기록 */}
      {started && (
        <div
          ref={logRef}
          className="h-24 w-full overflow-y-auto rounded-lg border border-foreground/15 bg-foreground/[0.03] p-3 font-mono text-[11px] leading-5 opacity-70"
        >
          {steps === null ? (
            <p className="opacity-60">추적 대기 중입니다. 참가자를 고르십시오.</p>
          ) : (
            steps.slice(0, row).map((step, r) => <p key={r}>{logLine(r, step)}</p>)
          )}
        </div>
      )}

      {/* 상태 문구 */}
      <div className="min-h-[64px] text-center">
        {done && picked !== null && current !== null ? (
          <>
            <p className="text-2xl font-bold">
              {names[picked] || "?"} <span className="opacity-40">→</span>{" "}
              {prizes[current] || "—"}
            </p>
            <p className="mt-1 text-sm opacity-60">
              {verdict(plays, names[picked] || "?", prizes[current] || "—", winner === current)}
            </p>
          </>
        ) : running ? (
          <p className="text-sm opacity-60">가로선을 확인하며 내려가는 중입니다…</p>
        ) : revealing ? (
          <p className="text-sm opacity-60">가로선을 확정하는 중입니다…</p>
        ) : started ? (
          <p className="text-sm opacity-60">
            가로선 {countRungs(rungs, cols)}개로 확정됐습니다. 참가자를 고르십시오.
          </p>
        ) : (
          <p className="text-sm opacity-60">
            시작을 누르면 지금 섞이고 있는 사다리가 그대로 확정됩니다.
          </p>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex flex-wrap justify-center gap-3">
        {!started ? (
          <button
            onClick={start}
            className="rounded-full bg-foreground px-10 py-3 text-sm font-bold text-background transition-all hover:opacity-90 active:scale-95"
          >
            시작
          </button>
        ) : (
          <>
            <button
              onClick={again}
              disabled={running || picked === null}
              className="rounded-full border border-foreground/20 px-6 py-3 text-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:bg-foreground/10 disabled:opacity-40"
            >
              다른 참가자 고르기
            </button>
            <button
              onClick={reset}
              disabled={running}
              className="rounded-full border border-foreground/20 px-6 py-3 text-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:bg-foreground/10 disabled:opacity-40"
            >
              처음부터
            </button>
          </>
        )}
      </div>

      <p className="max-w-md text-center text-xs opacity-50">
        가림막 안의 미리보기는 밀도 {PREVIEW_DENSITY.toFixed(2)}로 {PREVIEW_MS}밀리초마다
        다시 뽑습니다. 시작을 누르면 같은 생성기가 밀도 {RUNG_DENSITY.toFixed(2)}로 한 번
        더 돌아가고, 그때 확정된 사다리가 끝까지 쓰입니다.
      </p>
    </div>
  );
}
