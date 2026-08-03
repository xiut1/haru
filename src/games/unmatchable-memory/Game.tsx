"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 카드 20장 = 10쌍이어야 정상이다. 여기서는 20장이 전부 다른 그림이다.
 * 뒤집기·비교·되돌리기 규칙은 진짜 메모리 게임과 완전히 동일하게 굴린다.
 * 아래 SYMBOLS에 같은 값이 두 개 들어가면 실제로 짝이 맞는다. 안 넣을 뿐이다.
 */
const SYMBOLS = [
  "🍕",
  "🐙",
  "🎩",
  "🌵",
  "🚀",
  "🧦",
  "🍩",
  "🪐",
  "🐌",
  "🧊",
  "🎺",
  "🍄",
  "🦖",
  "🕯️",
  "🧵",
  "🪃",
  "🐠",
  "🥁",
  "🧅",
  "🔑",
];

const TOTAL_PAIRS = SYMBOLS.length / 2;
/** 짝이 아닐 때 다시 덮는 데 걸리는 시간 */
const FLIP_BACK_MS = 900;

type Card = { id: number; symbol: string };

function shuffle(symbols: string[]): Card[] {
  const cards = symbols.map((symbol, id) => ({ id, symbol }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** 시도 횟수별로 점점 무례해지는 코멘트 */
function comment(misses: number): string {
  if (misses >= 40) return "40번 틀렸습니다. 카드는 계속 여기 있을 겁니다.";
  if (misses >= 25) return "혹시 20장을 전부 외우셨나요. 아쉽게도 그건 상관이 없습니다.";
  if (misses >= 15) return "기억력의 문제는 아닙니다. 그건 확실히 말씀드릴 수 있습니다.";
  if (misses >= 8) return "규칙대로라면 슬슬 한 쌍쯤 나와야 정상이긴 합니다.";
  if (misses >= 4) return "아깝습니다. 두 장 다 잘 뒤집으셨습니다.";
  return "짝이 아닙니다. 다시 덮겠습니다.";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Game() {
  const [cards, setCards] = useState<Card[]>(() => shuffle(SYMBOLS));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [locked, setLocked] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flip = useCallback(
    (id: number) => {
      if (locked) return;
      if (flipped.includes(id) || matched.includes(id)) return;

      setRunning(true);

      if (flipped.length === 0) {
        setFlipped([id]);
        return;
      }

      const first = cards.find((c) => c.id === flipped[0]);
      const second = cards.find((c) => c.id === id);
      setFlipped([flipped[0], id]);
      setMoves((n) => n + 1);

      // 정직한 비교. 같으면 짝으로 남기고, 다르면 규칙대로 다시 덮는다.
      if (first && second && first.symbol === second.symbol) {
        setMatched((prev) => [...prev, first.id, second.id]);
        setFlipped([]);
        return;
      }

      setLocked(true);
      timer.current = setTimeout(() => {
        setFlipped([]);
        setMisses((n) => n + 1);
        setLocked(false);
      }, FLIP_BACK_MS);
    },
    [cards, flipped, locked, matched],
  );

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setCards(shuffle(SYMBOLS));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setMisses(0);
    setLocked(false);
    setSeconds(0);
    setRunning(false);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <dl className="flex gap-8 text-center text-sm">
        <div>
          <dt className="opacity-60">찾은 짝</dt>
          <dd className="text-xl font-bold tabular-nums">
            {matched.length / 2} / {TOTAL_PAIRS}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">시도</dt>
          <dd className="text-xl font-bold tabular-nums">{moves}</dd>
        </div>
        <div>
          <dt className="opacity-60">경과</dt>
          <dd className="text-xl font-bold tabular-nums">{formatTime(seconds)}</dd>
        </div>
      </dl>

      <div
        className="grid w-full max-w-md grid-cols-4 gap-2 sm:max-w-xl sm:grid-cols-5 sm:gap-3"
        style={{ perspective: "1000px" }}
      >
        {cards.map((card) => {
          const isUp = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => flip(card.id)}
              aria-label={isUp ? card.symbol : "덮인 카드"}
              className="relative aspect-square w-full"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isUp ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* 뒷면 */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl border border-foreground/20 bg-foreground/10 text-lg opacity-40 transition hover:bg-foreground/20"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  ?
                </div>
                {/* 앞면 */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl border border-foreground/30 bg-background text-3xl shadow-sm sm:text-4xl"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {card.symbol}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="min-h-[48px] text-center">
        {misses > 0 && !locked && (
          <p className="text-sm opacity-60">{comment(misses)}</p>
        )}
        {locked && <p className="text-sm opacity-60">비교 중…</p>}
      </div>

      <button
        onClick={reset}
        className="rounded-full border border-foreground/20 px-6 py-3 text-sm hover:bg-foreground/10"
      >
        다시 섞기
      </button>

      <p className="max-w-md text-center text-xs opacity-50">
        같은 그림 두 장을 찾으면 짝이 맞춰집니다. 카드는 매번 잘 섞입니다.
      </p>
    </div>
  );
}
