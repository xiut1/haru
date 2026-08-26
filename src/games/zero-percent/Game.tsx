"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  byTier,
  CHARS,
  EFFECT_RATES,
  ELEMENT_COLOR,
  ELEMENT_RATES,
  pull,
  RATES,
  rollEffect,
  TIER_LABEL,
  type Char,
  type Effect,
  type Tier,
} from "./data";
import {
  commit,
  getServerSnapshot,
  getSnapshot,
  reset,
  subscribe,
  type Stats,
} from "./store";

/**
 * 가챠다. 배너·연출·확률 고지·누적 통계·도감·중복 전환까지 전부 들어 있고
 * 전부 정상 작동한다. 재화는 무제한이라 얼마든지 돌리실 수 있다.
 *
 * 뺀 것은 ★4와 ★5의 확률뿐이다. 고지된 0.000%는 과장이 아니라 실제 값이고,
 * 천장도 없다.
 *
 * 소환 연출은 다른 가챠들처럼 금빛·무지개·일반으로 나뉘고 색까지 그럴듯하지만,
 * 결과와는 독립적으로 추첨된다. 10번에 한 번은 금빛 기둥이 성실하게 솟아오르고,
 * 그리고 ★3이 나온다.
 *
 * 카드의 속성 표기는 속성 색으로 쓴다. 빛은 노랗고 어둠은 보랏빛이다.
 * 거짓말이 아니라 진짜 정보이며, 다만 이 게임에는 전투도 편성도 상성도 없어서
 * 속성이 쓰이는 곳이 없다.
 */

type Phase = "idle" | "summon" | "reveal";

const EFFECT_LABEL: Record<Effect, string> = {
  gold: "금빛",
  rainbow: "무지개",
  normal: "일반",
};

/** 소환 연출. 등급이 높을수록 색도 요란하고 기둥도 굵고 링도 많다 */
const SHOW: Record<
  Effect,
  {
    ms: number;
    ray: string;
    opacity: string;
    spin: string;
    width: string;
    rings: number;
    pillar: string;
    glow: string;
  }
> = {
  normal: {
    ms: 1500,
    ray: "bg-[conic-gradient(from_0deg,transparent,#64748b,transparent,#cbd5e1,transparent)]",
    opacity: "opacity-20",
    spin: "10s",
    width: "w-20",
    rings: 1,
    pillar: "bg-gradient-to-t from-slate-400 via-slate-200 to-transparent",
    glow: "shadow-[0_0_70px_24px_rgba(203,213,225,0.28)]",
  },
  rainbow: {
    ms: 1900,
    ray: "bg-[conic-gradient(from_0deg,#f87171,#fbbf24,#4ade80,#38bdf8,#a78bfa,#f87171)]",
    opacity: "opacity-30",
    spin: "7s",
    width: "w-28",
    rings: 2,
    pillar: "bg-gradient-to-t from-fuchsia-500 via-sky-200 to-transparent",
    glow: "shadow-[0_0_110px_36px_rgba(217,70,239,0.45)]",
  },
  gold: {
    ms: 2500,
    ray: "bg-[conic-gradient(from_0deg,transparent,#fef3c7,transparent,#f59e0b,transparent,#fde68a,transparent,#fbbf24,transparent)]",
    opacity: "opacity-40",
    spin: "4.5s",
    width: "w-36",
    rings: 3,
    pillar: "bg-gradient-to-t from-amber-400 via-yellow-100 to-transparent",
    glow: "shadow-[0_0_140px_50px_rgba(251,191,36,0.6)]",
  },
};

/** 등급별 카드 외형. ★4·★5 쪽도 멀쩡히 준비돼 있습니다 */
const TIER_STYLE: Record<Tier, string> = {
  5: "border-amber-300 bg-gradient-to-b from-amber-500 to-amber-800 text-amber-50",
  4: "border-violet-300 bg-gradient-to-b from-violet-500 to-violet-800 text-violet-50",
  3: "border-stone-400 bg-gradient-to-b from-stone-500 to-stone-700 text-stone-50",
};

/** 라이트/다크 양쪽에서 읽히는 선에서 고른 값 */
const TIER_TEXT: Record<Tier, string> = {
  5: "text-amber-500",
  4: "text-violet-500",
  3: "text-stone-500",
};

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

function Card({ char, open, big }: { char: Char; open: boolean; big?: boolean }) {
  return (
    <div
      className={big ? "h-64 w-44 [perspective:900px]" : "h-32 w-full [perspective:900px]"}
    >
      <div
        className="relative size-full transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform: open ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* 뒷면 */}
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-white/25 bg-gradient-to-br from-slate-600 to-slate-900 [backface-visibility:hidden]">
          <span className="text-lg font-bold text-white/25">◆</span>
        </div>

        {/* 앞면 */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 text-center [backface-visibility:hidden] ${TIER_STYLE[char.tier]}`}
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className={big ? "text-base" : "text-[10px]"}>
            {TIER_LABEL[char.tier]}
          </span>
          <span
            className={`break-keep ${
              big ? "text-lg font-bold leading-tight" : "text-[11px] font-bold leading-tight"
            }`}
          >
            {char.name}
          </span>
          <span
            className={`font-bold ${ELEMENT_COLOR[char.element]} ${
              big ? "text-xs" : "text-[9px]"
            }`}
          >
            {char.element}
          </span>
          {big && <span className="mt-1 text-xs opacity-70">{char.note}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pulls, setPulls] = useState<Char[]>([]);
  const [effect, setEffect] = useState<Effect>("normal");
  const [opened, setOpened] = useState(0);
  const [lit, setLit] = useState(false);
  const [summary, setSummary] = useState({ fresh: 0, dupe: 0 });

  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [tab, setTab] = useState<Tier>(5);

  // 빛기둥은 한 프레임 뒤에 세워야 transition이 걸린다
  useEffect(() => {
    if (phase !== "summon") return;
    const raf = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // 연출이 끝나면 카드를 깐다
  useEffect(() => {
    if (phase !== "summon") return;
    const id = setTimeout(() => {
      setPhase("reveal");
      setOpened(0);
    }, SHOW[effect].ms);
    return () => clearTimeout(id);
  }, [phase, effect]);

  // 한 장씩 순서대로
  useEffect(() => {
    if (phase !== "reveal" || opened >= pulls.length) return;
    const id = setTimeout(() => setOpened((n) => n + 1), opened === 0 ? 280 : 140);
    return () => clearTimeout(id);
  }, [phase, opened, pulls.length]);

  const doPull = useCallback(
    (n: number) => {
      const got = Array.from({ length: n }, () => pull());
      const eff = rollEffect();

      const owned = { ...stats.owned };
      const tiers = { ...stats.byTier };
      let fresh = 0;
      let dupe = 0;
      for (const c of got) {
        tiers[c.tier] += 1;
        if (owned[c.id]) {
          owned[c.id] += 1;
          dupe += 1;
        } else {
          owned[c.id] = 1;
          fresh += 1;
        }
      }

      const next: Stats = {
        total: stats.total + n,
        byTier: tiers,
        byEffect: { ...stats.byEffect, [eff]: stats.byEffect[eff] + 1 },
        owned,
        shards: stats.shards + dupe,
      };
      commit(next);

      setSummary({ fresh, dupe });
      setPulls(got);
      setEffect(eff);
      setOpened(0);
      setLit(false);
      setPhase("summon");
    },
    [stats],
  );

  const done = phase === "reveal" && opened >= pulls.length;
  const collected = CHARS.filter((c) => (stats.owned[c.id] ?? 0) > 0).length;
  const obs = (n: number) => (stats.total === 0 ? "—" : pct(n / stats.total));
  /** 연출은 카드 장수가 아니라 뽑기 횟수로 센다 */
  const draws = stats.byEffect.gold + stats.byEffect.rainbow + stats.byEffect.normal;
  const obsDraw = (n: number) => (draws === 0 ? "—" : pct(n / draws));

  return (
    <div className="flex flex-col gap-8">
      {/* ── 배너 ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/15 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 p-6 text-white">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 animate-spin bg-[conic-gradient(from_0deg,transparent,#a78bfa,transparent,#38bdf8,transparent)] opacity-15"
          style={{ animationDuration: "24s" }}
        />
        <div className="relative">
          <p className="font-mono text-[10px] tracking-[0.3em] opacity-60">
            상시 배너 · 픽업 없음
          </p>
          <h2 className="mt-1 text-2xl font-bold">정직 소환</h2>
          <p className="mt-1 text-sm opacity-70">
            고지된 확률을 한 자리도 틀리지 않고 그대로 따릅니다.
          </p>

          <div className="mt-5 rounded-xl border border-white/15 bg-black/25 p-4">
            <p className="font-mono text-[10px] tracking-widest opacity-50">
              이 배너에서 만나실 수 있는 ★★★★★
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {byTier(5).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="opacity-45">{c.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-amber-300/70">
                    0.000%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="mr-auto">
              <p className="font-mono text-[10px] tracking-widest opacity-50">보유 재화</p>
              <p className="font-mono text-2xl font-bold leading-none">∞</p>
            </div>
            <button
              onClick={() => doPull(1)}
              className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold transition hover:bg-white/10"
            >
              1회 뽑기
            </button>
            <button
              onClick={() => doPull(10)}
              className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-85"
            >
              10연차 뽑기
            </button>
          </div>
        </div>
      </div>

      {/* ── 확률 고지 ──────────────────────────── */}
      <section className="text-sm">
        <h3 className="mb-2 font-bold">확률 고지</h3>
        <table className="w-full font-mono text-xs">
          <tbody>
            {RATES.map((r) => (
              <tr key={r.tier} className="border-b border-foreground/10">
                <td className={`py-1.5 ${TIER_TEXT[r.tier]}`}>{TIER_LABEL[r.tier]}</td>
                <td className="py-1.5 text-right tabular-nums">{pct(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs opacity-60">
          천장(확정 보장) 없음 · 픽업 없음 · 교환소 없음
        </p>

        <h3 className="mb-2 mt-5 font-bold">연출 등급</h3>
        <table className="w-full font-mono text-xs">
          <tbody>
            {EFFECT_RATES.map((r) => (
              <tr key={r.effect} className="border-b border-foreground/10">
                <td className="py-1.5 opacity-70">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{pct(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed opacity-60">
          연출 등급은 결과와 독립적으로 추첨됩니다. 금빛 기둥이 솟아오르더라도
          결과는 위 확률표를 따릅니다. 이 게임에서 0이 아닌 확률은 이 표뿐입니다.
        </p>

        <h3 className="mb-2 mt-5 font-bold">속성 분포</h3>
        <table className="w-full font-mono text-xs">
          <tbody>
            {ELEMENT_RATES.map((r) => (
              <tr key={r.element} className="border-b border-foreground/10">
                <td className={`py-1.5 ${ELEMENT_COLOR[r.element]}`}>{r.element}</td>
                <td className="py-1.5 text-right tabular-nums">{pct(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed opacity-60">
          카드의 속성 표기는 속성 색으로 적힙니다. 빛은 노랗고 어둠은 보랏빛이며,
          색이 알려 드리는 정보는 전부 사실입니다. 다만 이 게임에는 전투도 편성도
          상성도 없으므로 속성이 쓰이는 곳은 없습니다. 위 표는 1회 뽑기 기준이며,
          ★★★ 풀에 각 속성이 두 명씩 들어 있어 나온 값입니다.
        </p>
      </section>

      {/* ── 누적 기록 ──────────────────────────── */}
      <section className="text-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-bold">누적 기록</h3>
          {stats.total > 0 && (
            <button
              onClick={reset}
              className="text-xs opacity-50 underline hover:opacity-100"
            >
              기록 삭제
            </button>
          )}
        </div>

        <table className="w-full font-mono text-xs">
          <tbody>
            <tr className="border-b border-foreground/10">
              <td className="py-1.5 opacity-70">누적 뽑기</td>
              <td className="py-1.5 text-right tabular-nums">
                {stats.total.toLocaleString()}회
              </td>
            </tr>
            {RATES.map((r) => (
              <tr key={r.tier} className="border-b border-foreground/10">
                <td className={`py-1.5 ${TIER_TEXT[r.tier]}`}>{TIER_LABEL[r.tier]}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {stats.byTier[r.tier].toLocaleString()}회{" "}
                  <span className="opacity-50">(관측 {obs(stats.byTier[r.tier])})</span>
                </td>
              </tr>
            ))}
            <tr className="border-b border-foreground/10">
              <td className="py-1.5 opacity-70">금빛 연출</td>
              <td className="py-1.5 text-right tabular-nums">
                {stats.byEffect.gold.toLocaleString()}회 / {draws.toLocaleString()}뽑기{" "}
                <span className="opacity-50">(관측 {obsDraw(stats.byEffect.gold)})</span>
              </td>
            </tr>
            <tr className="border-b border-foreground/10">
              <td className="py-1.5 opacity-70">각성 재료</td>
              <td className="py-1.5 text-right tabular-nums">
                {stats.shards.toLocaleString()}개
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs opacity-60">
          각성 재료는 교환소가 열리면 사용하실 수 있습니다.
        </p>
      </section>

      {/* ── 도감 ───────────────────────────────── */}
      <section className="text-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-bold">도감</h3>
          <span className="font-mono text-xs opacity-50">
            {collected} / {CHARS.length}
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          {([5, 4, 3] as Tier[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                tab === t
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/20 opacity-60 hover:opacity-100"
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {byTier(tab).map((c) => {
            const count = stats.owned[c.id] ?? 0;
            return (
              <li
                key={c.id}
                className={`rounded-lg border p-3 ${
                  count > 0
                    ? "border-foreground/20"
                    : "border-dashed border-foreground/15 opacity-45"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{count > 0 ? c.name : "미획득"}</span>
                  <span className="shrink-0 font-mono text-[10px] opacity-60">
                    {count > 0 ? `×${count}` : pct(RATES.find((r) => r.tier === c.tier)!.rate)}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-60">
                  {count > 0 ? (
                    <>
                      <span className={ELEMENT_COLOR[c.element]}>{c.element}</span> ·{" "}
                      {c.note}
                    </>
                  ) : (
                    c.name
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 소환 연출 ──────────────────────────── */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black">
          {phase === "summon" && (
            <button
              onClick={() => setPhase("reveal")}
              className="absolute inset-0 flex cursor-pointer items-center justify-center"
              aria-label="연출 건너뛰기"
            >
              <div
                className={`absolute size-[200vmax] animate-spin rounded-full ${SHOW[effect].ray} ${SHOW[effect].opacity}`}
                style={{ animationDuration: SHOW[effect].spin }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.35)_45%,transparent_75%)]" />
              <div
                className={`absolute bottom-0 h-full origin-bottom transition-transform duration-1000 ease-out ${SHOW[effect].width} ${SHOW[effect].pillar} ${SHOW[effect].glow}`}
                style={{ transform: lit ? "scaleY(1)" : "scaleY(0)" }}
              />
              {Array.from({ length: SHOW[effect].rings }, (_, i) => (
                <div
                  key={i}
                  className="absolute animate-ping rounded-full border-2 border-white/40"
                  style={{
                    width: 180 + i * 90,
                    height: 180 + i * 90,
                    animationDelay: `${i * 400}ms`,
                  }}
                />
              ))}
              <p className="relative font-mono text-xs tracking-[0.5em] text-white/85 drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]">
                SUMMONING
              </p>
              <p className="absolute bottom-10 font-mono text-[10px] tracking-widest text-white/45 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
연출 등급 {EFFECT_LABEL[effect]} · 탭하면 건너뜁니다
              </p>
            </button>
          )}

          {phase === "reveal" && (
            <div className="flex w-full max-w-lg flex-col items-center gap-5 px-5">
              <p className="font-mono text-[10px] tracking-[0.3em] text-white/40">
                연출 등급 {EFFECT_LABEL[effect]}
              </p>

              <div
                className={
                  pulls.length === 1
                    ? "flex justify-center"
                    : "grid w-full grid-cols-5 gap-2"
                }
              >
                {pulls.map((c, i) => (
                  <Card key={i} char={c} open={i < opened} big={pulls.length === 1} />
                ))}
              </div>

              {done ? (
                <div className="flex flex-col items-center gap-3 text-center text-white">
                  <div className="font-mono text-xs leading-relaxed">
                    <p className="opacity-70">
                      <span className={TIER_TEXT[5]}>★★★★★</span>{" "}
                      {pulls.filter((c) => c.tier === 5).length}장 ·{" "}
                      <span className={TIER_TEXT[4]}>★★★★</span>{" "}
                      {pulls.filter((c) => c.tier === 4).length}장 ·{" "}
                      <span className={TIER_TEXT[3]}>★★★</span>{" "}
                      {pulls.filter((c) => c.tier === 3).length}장
                    </p>
                    <p className="mt-1 opacity-50">
                      신규 {summary.fresh}종 · 중복 {summary.dupe}장 (각성 재료 +
                      {summary.dupe})
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setPhase("idle")}
                      className="rounded-full border border-white/25 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      닫기
                    </button>
                    <button
                      onClick={() => doPull(pulls.length)}
                      className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-6 py-2 text-sm font-bold text-black transition hover:opacity-85"
                    >
                      한 번 더
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setOpened(pulls.length)}
                  className="rounded-full border border-white/25 px-5 py-2 text-sm text-white/70 transition hover:bg-white/10"
                >
                  전체 공개
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
