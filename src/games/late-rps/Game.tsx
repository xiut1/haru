"use client";

import { useEffect, useRef, useState } from "react";

type Hand = "rock" | "scissors" | "paper";

const HANDS: { id: Hand; emoji: string; label: string }[] = [
  { id: "scissors", emoji: "✌️", label: "가위" },
  { id: "rock", emoji: "✊", label: "바위" },
  { id: "paper", emoji: "🖐️", label: "보" },
];

/** key가 value를 이긴다. 아주 평범한 가위바위보 규칙이다. */
const BEATS: Record<Hand, Hand> = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

type Verdict = "win" | "draw" | "lose";

/** 판정은 정직하다. 후출이라서 결과가 그럴 뿐이다. */
function judge(player: Hand, opponent: Hand): Verdict {
  if (player === opponent) return "draw";
  return BEATS[player] === opponent ? "win" : "lose";
}

/** player를 이기는 손. 상대는 당신 손을 보고 나서 이걸 고른다. */
function counter(player: Hand): Hand {
  return (Object.keys(BEATS) as Hand[]).find((h) => BEATS[h] === player)!;
}

function hand(id: Hand) {
  return HANDS.find((h) => h.id === id)!;
}

const CHANT = ["가위", "바위", "보!"];
const CHANT_MS = 420;

/** 라운드가 갈수록 후출 간격이 줄어든다. 뻔뻔해지는 것이지 없어지는 건 아니다. */
function lagFor(round: number): number {
  return Math.max(120, 700 - round * 55);
}

/** 진 횟수별로 점점 무례해지는 코멘트 */
function comment(losses: number): string {
  if (losses >= 30) return "30패입니다. 이쯤 되면 규칙을 의심하실 때도 됐습니다.";
  if (losses >= 20) return "20패. 손 모양을 바꿔봐도 결과는 같습니다.";
  if (losses >= 12) return "상대가 조금씩 빨라지고 있습니다. 여전히 후출이지만요.";
  if (losses >= 7) return "패턴을 읽히신 것 같습니다. 읽을 필요도 없었지만요.";
  if (losses >= 3) return "판정에는 이상이 없습니다. 확인해보셔도 됩니다.";
  return "졌습니다. 상대가 조금 늦게 냈습니다.";
}

const VERDICT_TEXT: Record<Verdict, string> = {
  win: "이겼습니다",
  draw: "비겼습니다",
  lose: "졌습니다",
};

type Phase = "idle" | "chant" | "waiting" | "done";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chantStep, setChantStep] = useState(0);
  const [playerHand, setPlayerHand] = useState<Hand | null>(null);
  const [cpuHand, setCpuHand] = useState<Hand | null>(null);
  const [record, setRecord] = useState({ win: 0, draw: 0, lose: 0 });
  const [round, setRound] = useState(0);
  const [lag, setLag] = useState(lagFor(0));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function play(picked: Hand) {
    if (phase === "chant" || phase === "waiting") return;

    timers.current.forEach(clearTimeout);
    timers.current = [];

    const thisLag = lagFor(round);
    setLag(thisLag);
    setPlayerHand(picked);
    setCpuHand(null);
    setChantStep(0);
    setPhase("chant");

    later(() => setChantStep(1), CHANT_MS);
    later(() => setChantStep(2), CHANT_MS * 2);
    later(() => setPhase("waiting"), CHANT_MS * 3);

    // 상대는 여기서, 당신 손을 다 보고 나서 낸다.
    later(() => {
      const opponent = counter(picked);
      const verdict = judge(picked, opponent);
      setCpuHand(opponent);
      setPhase("done");
      setRound((n) => n + 1);
      setRecord((r) => ({ ...r, [verdict]: r[verdict] + 1 }));
    }, CHANT_MS * 3 + thisLag);
  }

  const verdict = playerHand && cpuHand ? judge(playerHand, cpuHand) : null;
  const busy = phase === "chant" || phase === "waiting";

  return (
    <div className="flex flex-col items-center gap-8">
      <dl className="flex gap-8 text-center text-sm">
        <div>
          <dt className="opacity-60">승</dt>
          <dd className="text-xl font-bold tabular-nums">{record.win}</dd>
        </div>
        <div>
          <dt className="opacity-60">무</dt>
          <dd className="text-xl font-bold tabular-nums">{record.draw}</dd>
        </div>
        <div>
          <dt className="opacity-60">패</dt>
          <dd className="text-xl font-bold tabular-nums">{record.lose}</dd>
        </div>
      </dl>

      <div className="flex w-full max-w-md items-stretch gap-3">
        {/* 당신 */}
        <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-foreground/15 p-4">
          <p className="text-xs opacity-60">당신</p>
          <div className="flex h-24 items-center justify-center text-6xl">
            {phase === "idle" || !playerHand ? (
              <span className="opacity-20">✊</span>
            ) : phase === "chant" ? (
              <span className="animate-pulse opacity-30">✊</span>
            ) : (
              <span>{hand(playerHand).emoji}</span>
            )}
          </div>
          <p className="text-xs font-medium tabular-nums opacity-60">
            {phase !== "idle" && phase !== "chant" && playerHand
              ? `${hand(playerHand).label} · 0.00초`
              : " "}
          </p>
        </div>

        <div className="flex items-center text-sm opacity-40">vs</div>

        {/* 상대 */}
        <div className="relative flex flex-1 flex-col items-center gap-2 rounded-2xl border border-foreground/15 p-4">
          <span className="absolute -top-2 right-3 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
            후출
          </span>
          <p className="text-xs opacity-60">상대</p>
          <div className="flex h-24 items-center justify-center text-6xl">
            {cpuHand ? (
              <span>{hand(cpuHand).emoji}</span>
            ) : phase === "waiting" ? (
              <span className="animate-pulse opacity-30">👀</span>
            ) : (
              <span className="opacity-20">✊</span>
            )}
          </div>
          <p className="text-xs font-medium tabular-nums opacity-60">
            {cpuHand
              ? `${hand(cpuHand).label} · +${(lag / 1000).toFixed(2)}초`
              : phase === "waiting"
                ? "확인 중…"
                : " "}
          </p>
        </div>
      </div>

      <div className="min-h-[64px] text-center">
        {phase === "chant" && (
          <p className="text-3xl font-bold">{CHANT[chantStep]}</p>
        )}
        {phase === "waiting" && (
          <p className="text-sm opacity-60">상대가 당신의 손을 보고 있습니다…</p>
        )}
        {phase === "done" && verdict && (
          <>
            <p className="text-3xl font-bold">{VERDICT_TEXT[verdict]}</p>
            <p className="mt-2 text-sm opacity-60">{comment(record.lose)}</p>
          </>
        )}
      </div>

      <div className="flex gap-3">
        {HANDS.map((h) => (
          <button
            key={h.id}
            onClick={() => play(h.id)}
            disabled={busy}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-foreground/20 transition hover:bg-foreground/10 disabled:opacity-30"
          >
            <span className="text-4xl">{h.emoji}</span>
            <span className="text-xs opacity-70">{h.label}</span>
          </button>
        ))}
      </div>

      <p className="max-w-md text-center text-xs opacity-50">
        동시에 내는 것이 원칙입니다. 상대의 출수 지연은 화면에 초 단위로 표시되며,
        판정은 표시된 두 손으로만 이루어집니다.
      </p>
    </div>
  );
}
