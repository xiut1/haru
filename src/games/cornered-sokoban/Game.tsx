"use client";

import { useEffect, useMemo, useReducer } from "react";

/**
 * 소코반 규칙은 전부 지킨다. 상하좌우 이동, 상자는 한 번에 하나만 밀 수 있고,
 * 당기기는 없다. 모든 상자가 목표 위에 올라가면 클리어. 되돌리기와 처음부터도
 * 진짜로 된다.
 *
 * 튜토리얼은 멀쩡하다. 1-1만 상자 하나가 처음부터 왼쪽 위 구석에 붙어서 나온다.
 * 위도 벽, 왼쪽도 벽이라 어느 방향으로도 밀 수 없고, 소코반에는 당기기가 없다.
 * 나머지 둘은 잘 밀리고 잘 들어간다. 그래서 늘 2 / 3에서 멈춘다.
 * 아래 탐색기가 실제로 전 국면을 뒤져서 「해 없음」을 낸다.
 */

type StageId = "tutorial" | "1-1";

type Stage = {
  id: StageId;
  label: string;
  map: string[];
};

const STAGES: Record<StageId, Stage> = {
  tutorial: {
    id: "tutorial",
    label: "튜토리얼",
    map: [
      "#######", //
      "#@ $ .#",
      "#######",
    ],
  },
  "1-1": {
    id: "1-1",
    label: "1-1",
    map: [
      "#########",
      "#$  #   #",
      "#   #   #",
      "#  $  . #",
      "## # $  #",
      "#  .  . #",
      "# @     #",
      "#########",
    ],
  },
};

/** 스테이지 선택 화면에 보이는 나머지. 1-1을 깨면 열린다. */
const LOCKED = Array.from({ length: 11 }, (_, i) => `1-${i + 2}`);

type Level = {
  width: number;
  height: number;
  walls: Set<number>;
  goals: Set<number>;
  player: number;
  boxes: number[];
};

function parse(map: string[]): Level {
  const width = map[0].length;
  const walls = new Set<number>();
  const goals = new Set<number>();
  const boxes: number[] = [];
  let player = 0;
  map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const i = y * width + x;
      if (c === "#") walls.add(i);
      if (c === "." || c === "*" || c === "+") goals.add(i);
      if (c === "$" || c === "*") boxes.push(i);
      if (c === "@" || c === "+") player = i;
    }),
  );
  return { width, height: map.length, walls, goals, player, boxes };
}

const LEVELS: Record<StageId, Level> = {
  tutorial: parse(STAGES.tutorial.map),
  "1-1": parse(STAGES["1-1"].map),
};

type Dir = "up" | "down" | "left" | "right";

function delta(dir: Dir, width: number): number {
  if (dir === "up") return -width;
  if (dir === "down") return width;
  if (dir === "left") return -1;
  return 1;
}

/**
 * 최소 수 탐색. 플레이어 위치 + 상자 배치를 국면으로 보고 너비 우선으로 전부 뒤진다.
 * 당기기가 없으니 국면 전이는 이동과 밀기뿐이다.
 */
function solve(level: Level): { moves: number | null; states: number } {
  const { width, walls, goals } = level;
  const dirs = [1, -1, width, -width];
  const key = (p: number, b: number[]) => `${p}|${[...b].sort((a, c) => a - c).join(",")}`;
  const done = (b: number[]) => b.every((i) => goals.has(i));

  let queue: [number, number[]][] = [[level.player, level.boxes]];
  const seen = new Set([key(level.player, level.boxes)]);

  for (let depth = 0; queue.length; depth++) {
    const next: [number, number[]][] = [];
    for (const [p, b] of queue) {
      if (done(b)) return { moves: depth, states: seen.size };
      for (const d of dirs) {
        const to = p + d;
        if (walls.has(to)) continue;
        let nb = b;
        const hit = b.indexOf(to);
        if (hit >= 0) {
          const behind = to + d;
          if (walls.has(behind) || b.includes(behind)) continue;
          nb = [...b];
          nb[hit] = behind;
        }
        const k = key(to, nb);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push([to, nb]);
      }
    }
    queue = next;
  }
  return { moves: null, states: seen.size };
}

/** 되돌리기 한 번이 되돌리는 단위. 수 카운터도 같이 되돌아간다. */
type Snapshot = {
  player: number;
  boxes: number[];
  facing: Dir;
  moves: number;
  pushes: number;
};

type GameEvent =
  | { type: "start" }
  | { type: "move" }
  | { type: "push"; box: number; onGoal: boolean }
  | { type: "wall" }
  | { type: "stuck"; box: number }
  | { type: "undo"; ok: boolean }
  | { type: "reset" };

type State = {
  stage: StageId;
  cur: Snapshot;
  history: Snapshot[];
  event: GameEvent;
  cleared: StageId[];
  /** 스테이지별 누적. 되돌려도 줄지 않는다. */
  undos: number;
  shoves: number;
  resets: number;
};

function fresh(stage: StageId): Snapshot {
  const level = LEVELS[stage];
  return { player: level.player, boxes: [...level.boxes], facing: "down", moves: 0, pushes: 0 };
}

function enter(s: State, stage: StageId): State {
  return {
    ...s,
    stage,
    cur: fresh(stage),
    history: [],
    event: { type: "start" },
    undos: 0,
    shoves: 0,
    resets: 0,
  };
}

function initial(): State {
  return {
    stage: "tutorial",
    cur: fresh("tutorial"),
    history: [],
    event: { type: "start" },
    cleared: [],
    undos: 0,
    shoves: 0,
    resets: 0,
  };
}

function isClear(stage: StageId, boxes: number[]): boolean {
  const { goals } = LEVELS[stage];
  return boxes.every((b) => goals.has(b));
}

type Action =
  | { type: "move"; dir: Dir }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "go"; stage: StageId };

function reducer(s: State, action: Action): State {
  const level = LEVELS[s.stage];
  const won = isClear(s.stage, s.cur.boxes);

  switch (action.type) {
    case "go":
      return enter(s, action.stage);

    case "reset":
      return {
        ...s,
        cur: fresh(s.stage),
        history: [],
        event: { type: "reset" },
        resets: s.resets + 1,
      };

    case "undo": {
      if (won) return s;
      const prev = s.history[s.history.length - 1];
      if (!prev) return { ...s, event: { type: "undo", ok: false } };
      return {
        ...s,
        cur: prev,
        history: s.history.slice(0, -1),
        event: { type: "undo", ok: true },
        undos: s.undos + 1,
      };
    }

    case "move": {
      if (won) return s;
      const { dir } = action;
      const d = delta(dir, level.width);
      const to = s.cur.player + d;
      const turned = { ...s, cur: { ...s.cur, facing: dir } };

      if (level.walls.has(to)) return { ...turned, event: { type: "wall" } };

      const hit = s.cur.boxes.indexOf(to);
      if (hit < 0) {
        return {
          ...s,
          history: [...s.history, s.cur],
          cur: { ...s.cur, player: to, facing: dir, moves: s.cur.moves + 1 },
          event: { type: "move" },
        };
      }

      const behind = to + d;
      if (level.walls.has(behind) || s.cur.boxes.includes(behind)) {
        // 구석 상자를 민 횟수만 센다. 따로 셀 가치가 있는 건 그것뿐이다.
        const corner = s.stage === "1-1" && hit === CORNER_BOX;
        return {
          ...turned,
          event: { type: "stuck", box: hit },
          shoves: s.shoves + (corner ? 1 : 0),
        };
      }

      const boxes = [...s.cur.boxes];
      boxes[hit] = behind;
      const done = isClear(s.stage, boxes);
      return {
        ...s,
        history: [...s.history, s.cur],
        cur: {
          player: to,
          boxes,
          facing: dir,
          moves: s.cur.moves + 1,
          pushes: s.cur.pushes + 1,
        },
        event: { type: "push", box: hit, onGoal: level.goals.has(behind) },
        cleared: done && !s.cleared.includes(s.stage) ? [...s.cleared, s.stage] : s.cleared,
      };
    }
  }
}

/** 구석 상자. 1-1의 0번 상자다. 한 번도 움직인 적이 없다. */
const CORNER_BOX = 0;

function tutorialText(s: State): string {
  const { cur, event } = s;
  const box = cur.boxes[0];
  const level = LEVELS.tutorial;
  if (level.goals.has(box)) return "상자가 목표에 올라갔습니다. 소코반은 이게 전부입니다.";
  if (event.type === "wall") return "거긴 벽입니다. 벽은 안 밀립니다.";
  if (event.type === "undo") return event.ok ? "한 수 되돌렸습니다. 실수했을 땐 이렇게 하시면 됩니다." : "더 되돌릴 게 없습니다.";
  if (cur.pushes === 1) return "좋습니다. 한 칸만 더 밀면 목표(점)입니다.";
  if (cur.moves === 0) return "방향키(또는 아래 버튼)로 움직이십시오.";
  return "상자 쪽으로 걸어가면 상자가 밀립니다.";
}

function stageText(s: State): string {
  const { cur, event, shoves } = s;
  const level = LEVELS["1-1"];
  const on = cur.boxes.filter((b) => level.goals.has(b)).length;
  const total = cur.boxes.length;

  switch (event.type) {
    case "start":
      return "1-1입니다. 튜토리얼에서 배우신 그대로입니다. 상자를 전부 목표에 올리십시오.";
    case "reset":
      return s.resets >= 3
        ? `${s.resets}번째 처음부터입니다. 배치는 매번 설계대로 똑같이 나옵니다.`
        : "처음부터 다시. 상자는 원래 자리로 돌아갔습니다. 전부요.";
    case "undo":
      if (!event.ok) return "처음 상태입니다. 그 상자는 처음부터 거기 있었습니다.";
      return s.undos >= 20
        ? `되돌리기 ${s.undos}회. 되돌리기는 완벽하게 작동하고 있습니다.`
        : "한 수 되돌렸습니다. 상자 위치도 정확히 복원됐습니다.";
    case "wall":
      return "벽입니다.";
    case "stuck":
      if (event.box !== CORNER_BOX) return "그쪽으론 안 밀립니다. 뒤가 막혀 있습니다.";
      if (shoves === 1) return "안 밀립니다. 상자 뒤가 벽입니다.";
      if (shoves === 2) return "상자는 밀 수만 있습니다. 당기기는 원래 소코반에 없습니다.";
      if (shoves === 3) return "위도 벽, 왼쪽도 벽입니다. 그 상자는 구석에 있습니다.";
      return `${shoves}번째 미셨습니다. 벽은 ${shoves}번 다 버텼습니다.`;
    case "push":
      if (!event.onGoal) return cur.pushes >= 40 ? "잘 밀고 계십니다." : "밀었습니다.";
      if (on === total - 1) return `${on} / ${total}. 하나 남았습니다. 남은 상자는 왼쪽 위에 있습니다.`;
      return `들어갔습니다. ${on} / ${total}.`;
    case "move":
      if (on === total - 1) return `${on} / ${total}. 왼쪽 위 상자만 올리시면 1-2가 열립니다.`;
      if (cur.moves >= 150) return `${cur.moves}수째입니다. 목표는 계속 ${total}개입니다.`;
      return "";
  }
}

const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const EYES: Record<Dir, string> = {
  up: "-translate-y-[3px]",
  down: "translate-y-[3px]",
  left: "-translate-x-[3px]",
  right: "translate-x-[3px]",
};

const LEAN: Record<Dir, string> = {
  up: "-translate-y-[18%]",
  down: "translate-y-[18%]",
  left: "-translate-x-[18%]",
  right: "translate-x-[18%]",
};

function at(i: number, width: number): string {
  const x = i % width;
  const y = Math.floor(i / width);
  return `translate(calc(var(--c) * ${x}), calc(var(--c) * ${y}))`;
}

export default function Game() {
  const [s, dispatch] = useReducer(reducer, undefined, initial);
  const level = LEVELS[s.stage];
  const tutorial = s.stage === "tutorial";

  const solution = useMemo(() => solve(level), [level]);

  const on = s.cur.boxes.filter((b) => level.goals.has(b)).length;
  const total = s.cur.boxes.length;
  const won = on === total;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEYS[e.code];
      if (dir) {
        e.preventDefault();
        dispatch({ type: "move", dir });
      } else if (e.code === "KeyZ" || e.code === "Backspace") {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if (e.code === "KeyR") {
        dispatch({ type: "reset" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const message = tutorial ? tutorialText(s) : stageText(s);
  const bumping = s.event.type === "wall" || s.event.type === "stuck";

  const pad = [
    { dir: "up" as Dir, label: "↑", pos: "col-start-2" },
    { dir: "left" as Dir, label: "←", pos: "col-start-1 row-start-2" },
    { dir: "down" as Dir, label: "↓", pos: "col-start-2 row-start-2" },
    { dir: "right" as Dir, label: "→", pos: "col-start-3 row-start-2" },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 스테이지 선택 */}
      <div className="flex w-full flex-wrap justify-center gap-1.5">
        {(Object.keys(STAGES) as StageId[]).map((id) => (
          <button
            key={id}
            onClick={() => dispatch({ type: "go", stage: id })}
            className={`rounded-full border px-3 py-1 font-mono text-xs ${
              s.stage === id
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 hover:bg-foreground/10"
            }`}
          >
            {STAGES[id].label}
            {/* 체크 자리를 미리 비워 둔다. 깨는 순간 줄바꿈이 생겨 판이 밀리지 않게. */}
            <span className={s.cleared.includes(id) ? "" : "invisible"}> ✓</span>
          </button>
        ))}
        {LOCKED.map((label) => (
          <button
            key={label}
            disabled
            title="1-1을 클리어하면 열립니다"
            className="cursor-not-allowed rounded-full border border-foreground/10 px-3 py-1 font-mono text-xs opacity-30"
          >
            {label} 🔒
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* 판 */}
        <div
          className="relative rounded-md [--c:clamp(30px,9vw,44px)]"
          style={{
            width: `calc(var(--c) * ${level.width})`,
            height: `calc(var(--c) * ${level.height})`,
          }}
        >
          {Array.from({ length: level.width * level.height }, (_, i) => {
            const wall = level.walls.has(i);
            const goal = level.goals.has(i);
            return (
              <div
                key={i}
                className={`absolute left-0 top-0 flex h-[var(--c)] w-[var(--c)] items-center justify-center ${
                  wall ? "rounded-[3px] bg-foreground/60 ring-1 ring-inset ring-foreground/20" : "bg-foreground/[0.04]"
                }`}
                style={{ transform: at(i, level.width) }}
              >
                {goal && (
                  <span className="block h-[30%] w-[30%] rounded-full border-2 border-emerald-500/80" />
                )}
              </div>
            );
          })}

          {s.cur.boxes.map((b, id) => {
            const placed = level.goals.has(b);
            const shaking = s.event.type === "stuck" && s.event.box === id;
            return (
              <div
                key={`${s.stage}-${id}`}
                className="absolute left-0 top-0 h-[var(--c)] w-[var(--c)] p-[calc(var(--c)*0.06)] transition-transform duration-100 ease-out"
                style={{ transform: at(b, level.width) }}
              >
                <div
                  className={`relative h-full w-full rounded-[4px] border-2 shadow-sm ring-red-500 transition-shadow ${
                    placed ? "border-emerald-800 bg-emerald-500" : "border-amber-900 bg-amber-600"
                  } ${shaking ? "ring-2" : "ring-0"}`}
                >
                  <span className="absolute inset-[18%] rounded-[2px] border border-black/25" />
                  <span className="absolute left-1/2 top-[18%] bottom-[18%] w-px -translate-x-1/2 bg-black/25" />
                </div>
              </div>
            );
          })}

          <div
            className="absolute left-0 top-0 h-[var(--c)] w-[var(--c)] p-[calc(var(--c)*0.12)] transition-transform duration-100 ease-out"
            style={{ transform: at(s.cur.player, level.width) }}
          >
            {/* 막힌 쪽으로 몸을 기댄다. 다음 입력 전까지 기대고 있다. */}
            <div
              className={`flex h-full w-full items-center justify-center gap-[3px] rounded-full bg-sky-500 shadow transition-transform duration-100 ${
                bumping ? LEAN[s.cur.facing] : ""
              }`}
            >
              <span className={`h-[5px] w-[5px] rounded-full bg-white transition-transform ${EYES[s.cur.facing]}`} />
              <span className={`h-[5px] w-[5px] rounded-full bg-white transition-transform ${EYES[s.cur.facing]}`} />
            </div>
          </div>

          {won && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-background/85">
              <p className="text-xl font-bold">
                {tutorial ? "튜토리얼 클리어" : "스테이지 클리어"}
              </p>
              {tutorial && (
                <button
                  onClick={() => dispatch({ type: "go", stage: "1-1" })}
                  className="rounded-full bg-foreground px-5 py-2 text-sm text-background hover:opacity-80"
                >
                  1-1로 →
                </button>
              )}
            </div>
          )}
        </div>

        {/* 기록 */}
        <dl className="flex w-full flex-row flex-wrap justify-center gap-x-6 gap-y-3 text-sm sm:w-36 sm:flex-col sm:justify-start">
          <div>
            <dt className="text-xs opacity-60">스테이지</dt>
            <dd className="font-bold">{STAGES[s.stage].label}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">목표 위 상자</dt>
            <dd className="font-bold tabular-nums">
              {on} / {total}
            </dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">이동 / 밀기</dt>
            <dd className="font-bold tabular-nums">
              {s.cur.moves} / {s.cur.pushes}
            </dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">최소 수</dt>
            <dd className="font-bold tabular-nums">
              {solution.moves ?? "해 없음"}
            </dd>
          </div>
          {!tutorial && (
            <div>
              <dt className="text-xs opacity-60">되돌리기</dt>
              <dd className="font-bold tabular-nums">{s.undos}회</dd>
            </div>
          )}
        </dl>
      </div>

      <p className="min-h-[40px] max-w-md text-center text-sm opacity-70">{message}</p>

      {/* 모바일용 방향 버튼 */}
      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 sm:hidden">
        {pad.map(({ dir, label, pos }) => (
          <button
            key={dir}
            onClick={() => dispatch({ type: "move", dir })}
            className={`${pos} h-12 w-12 rounded-lg border border-foreground/20 text-lg active:bg-foreground/15`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => dispatch({ type: "undo" })}
          className="rounded-full border border-foreground/20 px-5 py-2.5 text-sm hover:bg-foreground/10"
        >
          되돌리기 <span className="font-mono text-xs opacity-50">Z</span>
        </button>
        <button
          onClick={() => dispatch({ type: "reset" })}
          className="rounded-full border border-foreground/20 px-5 py-2.5 text-sm hover:bg-foreground/10"
        >
          처음부터 <span className="font-mono text-xs opacity-50">R</span>
        </button>
      </div>

      <p className="max-w-md text-center text-xs opacity-50">
        최소 수는 플레이어 위치와 상자 배치를 국면으로 잡고 너비 우선 탐색으로 전부 뒤져
        계산합니다. 이 스테이지에서 읽은 국면은 {solution.states.toLocaleString()}개입니다.
      </p>

    </div>
  );
}
