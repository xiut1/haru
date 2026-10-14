"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Forge, Head, type Scene } from "./Forge";
import {
  EXCUSES,
  GREETING,
  honestFail,
  OPENERS,
  pick,
  TABLE,
  type Excuse,
  type Face,
  type Line,
} from "./script";

/**
 * 무기 강화소다. 확률표는 흔한 그 표고, 판정 주사위도 진짜로 굴린다.
 * +0→+1 판정 성공 확률은 95%이고 실측해 보면 정말 95% 근처로 나온다.
 *
 * 뺀 것은 실력 있는 대장장이 하나다. 판정에 성공하면 시공은 대장장이가 맡는데,
 * 망치를 날리거나 커피에 담금질하거나 옆집 손님 칼을 강화한다.
 * 그래서 무기는 영원히 +0이고, 실패할 때마다 이름 앞에 뭔가가 붙는다.
 *
 * 판정이 실패하는 5%만 확률표대로 실패한다. 이때만 대장장이 탓이 아니고, 대장장이는 기뻐한다.
 */

const BASE_NAME = "녹슨 단검";
const START_GOLD = 1000;
/** 이름 앞에 붙는 말은 최근 것부터 이만큼만 */
const MAX_PREFIX = 3;
const TYPE_MS = 26;

const IDLE: Scene = {
  w: "anvil",
  heat: false,
  glow: false,
  flipped: false,
  bent: false,
  hammer: true,
  cat: false,
  steam: false,
  fire: false,
  zzz: false,
};

type Run = {
  id: number;
  lines: Line[];
  excuse: Excuse | null;
};

type Stats = {
  tries: number;
  judged: number;
  forged: number;
  spent: number;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const won = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()}G`;

function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 대본에 표정이 안 적혀 있으면 장면을 보고 고른다 */
function faceFor(line: Line, scene: Scene, ended: boolean, honest: boolean): Face {
  if (ended) return honest ? "smug" : "uh";
  if (scene.zzz) return "sleep";
  if (line.who !== "smith") return "normal";
  if (line.face) return line.face;
  if (line.hits) return "focus";
  if (scene.glow) return "smug";
  if (line.text.startsWith("…")) return "uh";
  return "normal";
}

/** 인벤토리 칸에 들어가는 작은 단검 */
function DaggerIcon({ bent }: { bent: boolean }) {
  return (
    <svg viewBox="-62 -30 124 60" className="size-full -rotate-45" aria-hidden>
      <rect x={-55} y={-5} width={31} height={10} rx={3} fill="#78350f" />
      <circle cx={-58} cy={0} r={6} fill="#71717a" />
      <rect x={-27} y={-13} width={6} height={26} rx={2} fill="#71717a" />
      <path
        d={bent ? "M-22 -6 Q12 -6 32 -15 L49 -26 L42 -9 Q12 6 -22 6 Z" : "M-22 -6 L44 -5.5 L58 0 L44 5.5 L-22 6 Z"}
        fill="#a8a29e"
      />
      <circle cx={9} cy={2} r={2.5} fill="#9a3412" opacity={0.7} />
    </svg>
  );
}

export default function Game() {
  const [run, setRun] = useState<Run | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [down, setDown] = useState(false);
  const [flash, setFlash] = useState(false);

  const [gold, setGold] = useState(START_GOLD);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [bent, setBent] = useState(false);
  const [stats, setStats] = useState<Stats>({ tries: 0, judged: 0, forged: 0, spent: 0 });
  const [seen, setSeen] = useState<string[]>([]);

  /** 같은 변명을 연달아 듣지 않게 한 바퀴씩 섞어서 꺼낸다 */
  const bag = useRef<Excuse[]>([]);
  const nextId = useRef(1);

  const row = TABLE[0];
  const lines = run?.lines ?? [{ who: "smith" as const, text: GREETING }];
  const line = lines[Math.min(idx, lines.length - 1)];
  const last = idx >= lines.length - 1;
  const busy = run !== null && !last;
  const doneTyping = typed >= line.text.length;

  // 지금 줄까지의 연출을 차례로 겹쳐서 장면을 만든다
  const scene = useMemo<Scene>(() => {
    const base: Scene = { ...IDLE, bent };
    if (!run || last) return base;
    return run.lines.slice(0, idx + 1).reduce<Scene>((acc, l) => ({ ...acc, ...l.fx }), base);
  }, [run, idx, last, bent]);

  const face = faceFor(line, scene, run !== null && last, run?.excuse === null);

  // 한 글자씩
  useEffect(() => {
    if (typed >= line.text.length) return;
    const id = setTimeout(() => setTyped((t) => t + 1), TYPE_MS);
    return () => clearTimeout(id);
  }, [typed, line.text.length]);

  // 망치질. 줄이 바뀌면 남은 타격은 취소된다
  useEffect(() => {
    const hits = line.hits ?? 0;
    if (!run || hits === 0) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    for (let k = 0; k < hits; k++) {
      const t = 150 + k * 380;
      ids.push(setTimeout(() => setDown(true), t));
      ids.push(setTimeout(() => setFlash(true), t + 90));
      ids.push(
        setTimeout(() => {
          setDown(false);
          setFlash(false);
        }, t + 160),
      );
    }
    return () => {
      ids.forEach(clearTimeout);
      setDown(false);
      setFlash(false);
    };
  }, [run, idx, line.hits]);

  const finish = useCallback((r: Run) => {
    const ex = r.excuse;
    if (!ex) return;
    setSeen((xs) => (xs.includes(ex.id) ? xs : [...xs, ex.id]));
    if (ex.replace) {
      setPrefixes([]);
      setBent(false);
      return;
    }
    if (ex.id === "forge") setBent(true);
    if (ex.prefix) {
      const p = ex.prefix;
      setPrefixes((xs) => [p, ...xs.filter((x) => x !== p)].slice(0, MAX_PREFIX));
    }
  }, []);

  const advance = useCallback(() => {
    if (!run) return;
    if (!doneTyping) {
      setTyped(line.text.length);
      return;
    }
    if (last) return;
    const next = idx + 1;
    setIdx(next);
    setTyped(0);
    if (next === run.lines.length - 1) finish(run);
  }, [run, doneTyping, line.text.length, last, idx, finish]);

  const forge = () => {
    if (busy) return;

    const roll = Math.random();
    const judged = roll < row.ok;
    const head: Line[] = [];

    if (gold < row.cost) {
      head.push({
        who: "smith",
        text:
          gold >= 0
            ? "돈이 좀 모자라시네요. 괜찮습니다, 외상 달아 드릴게요."
            : pick(["외상 추가요.", "장부에 적어 둘게요.", "외상이 쌓이네요. 괜찮습니다, 저도 쌓였어요."]),
      });
    }

    head.push({
      who: "sys",
      text: `주사위 ${roll.toFixed(3)} ${judged ? "<" : "≥"} ${row.ok.toFixed(3)} → 판정 ${judged ? "성공" : "실패"}`,
    });

    let excuse: Excuse | null = null;
    let body: Line[];
    if (judged) {
      if (bag.current.length === 0) {
        const lastId = run?.excuse?.id;
        const fresh = shuffled(EXCUSES);
        // 바퀴가 바뀔 때도 직전 변명이 바로 또 나오지 않게
        if (fresh[fresh.length - 1].id === lastId) fresh.unshift(fresh.pop()!);
        bag.current = fresh;
      }
      excuse = bag.current.pop()!;
      body = [{ who: "smith", text: pick(OPENERS) }, ...excuse.lines()];
    } else {
      body = honestFail();
    }

    const tail: Line = {
      who: "sys",
      text: excuse?.replace
        ? `강화 실패 · 새 ${BASE_NAME} +0 지급`
        : `강화 실패 · +0 유지${excuse?.prefix ? ` · 「${excuse.prefix}」 붙음` : ""}`,
    };

    setGold((g) => g - row.cost);
    setStats((s) => ({
      ...s,
      tries: s.tries + 1,
      judged: s.judged + (judged ? 1 : 0),
      spent: s.spent + row.cost,
    }));
    setRun({ id: nextId.current++, lines: [...head, ...body, tail], excuse });
    setIdx(0);
    setTyped(0);
  };

  // 스페이스·엔터로 대사 넘기기. 버튼에 포커스가 있으면 버튼이 알아서 처리한다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT" || t.tagName === "SUMMARY")) return;
      if (!busy) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, advance]);

  const observed = stats.tries === 0 ? "—" : pct(stats.judged / stats.tries);
  const ended = run !== null && last;
  const portrait = line.who === "smith" || (line.who === "sys" && ended);

  return (
    <div className="flex flex-col gap-10">
      <div className="overflow-hidden rounded-2xl border border-foreground/15 shadow-sm">
        {/* ── 강화 대상 ───────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="relative size-14 shrink-0 rounded-lg border-2 border-stone-400/60 bg-gradient-to-br from-stone-500/25 to-stone-700/25 p-1.5">
            <DaggerIcon bent={bent} />
            <span className="absolute -bottom-1.5 -right-1.5 rounded bg-stone-600 px-1 font-mono text-[10px] font-bold text-white">
              +0
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-widest opacity-50">일반 · 한손 단검</p>
            <p className="mt-0.5 text-base font-bold leading-snug break-keep sm:text-lg">
              {prefixes.map((p) => (
                <span key={p} className="text-amber-600 dark:text-amber-400">
                  {p}{" "}
                </span>
              ))}
              {BASE_NAME} <span className="font-mono">+0</span>
            </p>
            <p className="font-mono text-xs opacity-60">
              공격력 {row.atk} <span className="opacity-60">→ 다음 단계 {TABLE[1].atk}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] tracking-widest opacity-50">
              {gold < 0 ? "외상" : "소지금"}
            </p>
            <p
              className={`flex items-center justify-end gap-1.5 font-mono text-base font-bold tabular-nums sm:text-lg ${
                gold < 0 ? "text-red-500" : ""
              }`}
            >
              <span className="inline-block size-3.5 rounded-full border border-amber-700 bg-gradient-to-br from-yellow-200 to-amber-500" />
              {won(gold)}
            </p>
          </div>
        </div>

        {/* ── 대장간 ───────────────────────────── */}
        <div className="relative bg-stone-950">
          <Forge scene={scene} face={face} down={down} flash={flash} />

          {/* 결과 도장 */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              opacity: ended ? 1 : 0,
              transform: ended ? "scale(1) rotate(-8deg)" : "scale(1.6) rotate(-14deg)",
              transition: ended
                ? "opacity 180ms ease-out, transform 260ms cubic-bezier(.3,1.5,.5,1)"
                : "opacity 150ms, transform 0ms 150ms",
            }}
          >
            <div className="rounded-lg border-4 border-red-500 bg-stone-950/40 px-5 py-2 text-center text-red-500 shadow-[0_0_0_3px_rgba(0,0,0,0.25)] backdrop-blur-[1px]">
              <p className="text-2xl font-black tracking-[0.2em] sm:text-3xl">강화 실패</p>
              <p className="font-mono text-xs font-bold tracking-widest">
                {run?.excuse?.replace ? "새 단검 지급" : "+0 유지"}
              </p>
            </div>
          </div>
        </div>

        {/* ── 대화상자 ─────────────────────────── */}
        <button
          type="button"
          onClick={advance}
          disabled={!busy && doneTyping}
          className="relative flex min-h-36 w-full items-start gap-4 border-t-4 border-stone-800 bg-stone-900 px-5 py-4 text-left text-stone-100 disabled:cursor-default"
        >
          {portrait && (
            <div className="size-16 shrink-0 overflow-hidden rounded-lg border-2 border-amber-700/70 bg-gradient-to-b from-stone-700 to-stone-800 sm:size-20">
              <svg viewBox="-30 -26 60 60" className="size-full" aria-hidden>
                <path d="M-30 34 Q-26 18 0 16 Q26 18 30 34 Z" fill="#a8a29e" />
                <path d="M-14 34 L-12 22 L12 22 L14 34 Z" fill="#78350f" />
                <Head face={face} />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {line.who === "smith" && (
              <span className="mb-1.5 inline-block rounded bg-amber-700 px-2 py-0.5 text-xs font-bold text-amber-50">
                대장장이 박씨 <span className="font-normal opacity-75">· 견습 3일차</span>
              </span>
            )}
            {line.who === "sys" && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded bg-stone-700 px-2 py-0.5 font-mono text-xs font-bold text-stone-200">
                <span className="inline-grid size-3 grid-cols-2 place-items-center rounded-[3px] bg-stone-100 p-[2px]">
                  <span className="size-[3px] rounded-full bg-stone-800" />
                  <span className="size-[3px] rounded-full bg-stone-800 opacity-0" />
                  <span className="size-[3px] rounded-full bg-stone-800 opacity-0" />
                  <span className="size-[3px] rounded-full bg-stone-800" />
                </span>
                판정
              </span>
            )}
            <p
              className={`break-keep leading-relaxed ${
                line.who === "narr" ? "pt-3 text-center italic text-stone-400" : ""
              } ${line.who === "sys" ? "font-mono text-sm" : "text-[15px]"} ${
                ended ? "font-bold text-red-400" : ""
              }`}
            >
              {line.text.slice(0, typed)}
              {!doneTyping && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-stone-300" />}
            </p>
          </div>
          {busy && doneTyping && (
            <span className="absolute bottom-3 right-4 animate-bounce text-xs text-amber-400">▼</span>
          )}
        </button>

        {/* ── 강화 ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-foreground/15 px-5 py-4">
          <div className="mr-auto">
            <p className="font-mono text-[10px] tracking-widest opacity-50">+0 → +1 판정 확률</p>
            <div className="mt-1.5 flex h-2 w-44 overflow-hidden rounded-full bg-foreground/10">
              <div className="bg-emerald-500" style={{ width: pct(row.ok) }} />
              <div className="bg-stone-400" style={{ width: pct(row.keep) }} />
            </div>
            <p className="mt-1 font-mono text-xs opacity-70">
              <span className="text-emerald-600 dark:text-emerald-400">성공 {pct(row.ok)}</span> · 유지{" "}
              {pct(row.keep)} · 하락 {pct(row.down)} · 파괴 {pct(row.boom)}
            </p>
          </div>
          <button
            type="button"
            onClick={forge}
            disabled={busy}
            className="group relative overflow-hidden rounded-xl border-b-4 border-amber-800 bg-gradient-to-b from-amber-400 to-amber-600 px-7 py-3 text-sm font-black text-amber-950 shadow-sm transition active:translate-y-0.5 active:border-b-2 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span className="relative">강화하기</span>
            <span className="relative ml-2 font-mono text-xs font-bold opacity-75">
              {row.cost.toLocaleString()}G
            </span>
          </button>
        </div>
      </div>
      {busy && (
        <p className="-mt-8 text-center text-xs opacity-50">
          대화상자를 누르거나 스페이스를 누르시면 넘어갑니다. 결과는 안 바뀝니다.
        </p>
      )}

      {/* ── 기록 ───────────────────────────────── */}
      <section className="text-sm">
        <h3 className="mb-3 font-bold">기록</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "강화 시도", v: `${stats.tries.toLocaleString()}회`, sub: won(-stats.spent).replace("−", "") + " 지출" },
            { k: "판정 성공", v: `${stats.judged.toLocaleString()}회`, sub: `실측 ${observed} · 고지 ${pct(row.ok)}` },
            { k: "강화 성공", v: `${stats.forged}회`, sub: "대장장이 시공 기준", accent: true },
            { k: "변명 도감", v: `${seen.length} / ${EXCUSES.length}`, sub: "판정 성공 시 수집" },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-foreground/10 px-3.5 py-3">
              <p className="text-xs opacity-60">{c.k}</p>
              <p className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${c.accent ? "text-red-500" : ""}`}>
                {c.v}
              </p>
              <p className="mt-0.5 font-mono text-[10px] opacity-50">{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 변명 도감 ───────────────────────────── */}
      <section className="text-sm">
        <h3 className="mb-3 font-bold">변명 도감</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXCUSES.map((e, i) => {
            const got = seen.includes(e.id);
            return (
              <li
                key={e.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  got
                    ? "border-amber-600/40 bg-amber-500/10"
                    : "border-dashed border-foreground/15 opacity-45"
                }`}
              >
                <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate font-medium">{got ? e.title : "???"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs opacity-60">
          다 모으셔도 대장장이 실력은 그대로입니다.
        </p>
      </section>

      {/* ── 확률표 ─────────────────────────────── */}
      <section className="text-sm">
        <h3 className="mb-3 font-bold">강화 확률표</h3>
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.04] text-left">
                <th className="px-3 py-2 font-normal opacity-60">단계</th>
                <th className="px-3 py-2 text-right font-normal opacity-60">성공</th>
                <th className="px-3 py-2 text-right font-normal opacity-60">유지</th>
                <th className="px-3 py-2 text-right font-normal opacity-60">하락</th>
                <th className="px-3 py-2 text-right font-normal opacity-60">파괴</th>
                <th className="px-3 py-2 text-right font-normal opacity-60">비용</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map((r) => (
                <tr
                  key={r.from}
                  className={`border-b border-foreground/5 last:border-0 ${
                    r.from === 0 ? "bg-amber-500/10 font-bold" : "opacity-45"
                  }`}
                >
                  <td className="px-3 py-1.5">
                    +{r.from} → +{r.from + 1}
                    {r.from === 0 && <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">◀ 현재</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.ok)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.keep)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.down)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${r.boom > 0 ? "text-red-500" : ""}`}>
                    {pct(r.boom)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.cost.toLocaleString()}G</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed opacity-60">
          위 확률은 판정 주사위의 확률이며 실제로 그대로 굴립니다. 판정에 성공하면 그다음 시공은
          대장장이가 맡습니다. 하락은 한 단계 내려가는 것, 파괴는 새 {BASE_NAME} +0으로 바꿔 드리는
          것입니다. +1 이상의 행은 참고용입니다.
        </p>
      </section>
    </div>
  );
}
