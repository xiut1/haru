"use client";

import { useMemo, useRef, useState } from "react";

const DEFAULT_ITEMS = ["김치찌개", "돈까스", "샐러드", "라면", "그냥 굶기"];
const RESPIN = "다시 돌리기";

const SLICE_COLORS = [
  "#f87171",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#a3e635",
];

/** 돌린 횟수별로 점점 무례해지는 코멘트 */
function comment(attempts: number): string {
  if (attempts >= 30) return "30번. 이건 이제 저희 둘 다의 문제입니다.";
  if (attempts >= 20) return "20번 돌렸습니다. 룰렛은 지치지 않습니다.";
  if (attempts >= 12) return "혹시 결정을 룰렛에 맡기는 게 문제 아닐까요.";
  if (attempts >= 8) return "다음엔 좀 더 오래 돌려드릴게요. 서비스입니다.";
  if (attempts >= 5) return "공정한 추첨이었습니다. 결과가 그럴 뿐입니다.";
  if (attempts >= 3) return "이번에도 «다시 돌리기»네요. 확률은 정직합니다.";
  return "아쉽네요. 한 번 더 돌려보세요.";
}

export default function Game() {
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS);
  const [draft, setDraft] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [wastedMs, setWastedMs] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마지막 칸은 언제나 «다시 돌리기». 그리고 바늘은 언제나 마지막 칸에 선다.
  const segments = useMemo(() => [...items, RESPIN], [items]);
  const sliceAngle = 360 / segments.length;

  const background = useMemo(() => {
    const stops = segments.map((_, i) => {
      const color =
        i === segments.length - 1 ? "#1f2937" : SLICE_COLORS[i % SLICE_COLORS.length];
      return `${color} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`;
    });
    return `conic-gradient(from 0deg, ${stops.join(", ")})`;
  }, [segments, sliceAngle]);

  // 돌릴수록 회전 시간이 길어진다. 정중하게, 아주 조금씩.
  const spinSeconds = Math.min(3 + attempts * 0.6, 14);

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);

    const targetIndex = segments.length - 1;
    const center = targetIndex * sliceAngle + sliceAngle / 2;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.6;
    const want = (((-(center + jitter)) % 360) + 360) % 360;

    const turns = 5 + attempts;
    let next = Math.floor(rotation / 360) * 360 + turns * 360 + want;
    if (next <= rotation) next += 360;
    setRotation(next);

    timer.current = setTimeout(() => {
      setSpinning(false);
      setResult(RESPIN);
      setAttempts((n) => n + 1);
      setWastedMs((ms) => ms + spinSeconds * 1000);
    }, spinSeconds * 1000);
  }

  function addItem() {
    const value = draft.trim();
    if (!value || items.length >= 7) return;
    setItems((prev) => [...prev, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative h-[300px] w-[300px] sm:h-[360px] sm:w-[360px]">
        {/* 바늘 */}
        <div className="absolute left-1/2 top-[-14px] z-10 -translate-x-1/2 text-3xl leading-none">
          ▼
        </div>

        <div
          className="h-full w-full rounded-full border-4 border-foreground/80 shadow-xl"
          style={{
            background,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${spinSeconds}s cubic-bezier(0.16, 0.9, 0.2, 1)`
              : "none",
          }}
        >
          {segments.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="absolute left-1/2 top-0 h-1/2 w-0 origin-bottom"
              style={{ transform: `rotate(${i * sliceAngle + sliceAngle / 2}deg)` }}
            >
              <span
                className={`absolute left-1/2 top-[14%] -translate-x-1/2 whitespace-nowrap text-xs font-bold sm:text-sm ${
                  i === segments.length - 1 ? "text-white" : "text-black/80"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-foreground/80 bg-background" />
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="rounded-full bg-foreground px-10 py-4 text-lg font-bold text-background transition hover:opacity-80 disabled:opacity-40"
      >
        {spinning ? `돌아가는 중… (${spinSeconds.toFixed(1)}초)` : "돌리기"}
      </button>

      <div className="min-h-[72px] text-center">
        {result && (
          <>
            <p className="text-2xl font-bold">오늘의 메뉴: {result}</p>
            <p className="mt-2 text-sm opacity-60">{comment(attempts)}</p>
          </>
        )}
      </div>

      <dl className="flex gap-8 text-center text-sm">
        <div>
          <dt className="opacity-60">돌린 횟수</dt>
          <dd className="text-xl font-bold tabular-nums">{attempts}</dd>
        </div>
        <div>
          <dt className="opacity-60">낭비한 시간</dt>
          <dd className="text-xl font-bold tabular-nums">
            {(wastedMs / 1000).toFixed(1)}초
          </dd>
        </div>
      </dl>

      <div className="w-full max-w-md border-t border-foreground/15 pt-6">
        <p className="mb-3 text-sm opacity-60">
          선택지 편집 (최대 7개). 결과에는 아무 영향이 없습니다.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <button
              key={`${item}-${i}`}
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded-full border border-foreground/20 px-3 py-1 text-sm hover:bg-foreground/10"
            >
              {item} ×
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="선택지 추가"
            className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50"
          />
          <button
            onClick={addItem}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/10"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
