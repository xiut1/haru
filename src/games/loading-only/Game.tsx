"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 대작 오픈월드 RPG의 로딩 화면이다. 로딩 화면은 진짜로 잘 만들었다.
 * 진행률은 아래 PHASES의 일정표를 정직하게 따라가고, 남은 시간도 거짓말을
 * 하지 않는다. 실제로 그 시간이 걸린다. 셰이더 개수도 끝까지 센다.
 *
 * 빠진 것은 게임 본편이다.
 */

type Phase = {
  name: string;
  /** 이 단계에 걸리는 시간(초) */
  seconds: number;
  /** 이 단계가 끝났을 때의 진행률(%) */
  to: number;
  /** 진행률 곡선. 1보다 작으면 처음에 빠르고, 크면 처음에 느리다 */
  ease: number;
  logs: string[];
};

/** 합계 약 28초. 한 줄도 건너뛸 수 없다. */
const PHASES: Phase[] = [
  {
    name: "엔진 초기화",
    seconds: 2.4,
    to: 6,
    ease: 0.8,
    logs: [
      "HARU ENGINE 4.2.1 (build 20260813) 시작",
      "렌더러: 소프트웨어 폴백으로 전환합니다",
      "오디오 장치 검색… 1개 찾음",
      "저장 파일이 없습니다. 새 이야기를 시작합니다",
    ],
  },
  {
    name: "셰이더 컴파일",
    seconds: 5.4,
    to: 27,
    ease: 1.15,
    logs: [
      "셰이더 컴파일 118/1847",
      "셰이더 컴파일 409/1847",
      "셰이더 컴파일 655/1847",
      "셰이더 컴파일 902/1847  (물 표면 굴절)",
      "셰이더 컴파일 1183/1847",
      "셰이더 컴파일 1476/1847  (안개 산란)",
      "셰이더 컴파일 1731/1847",
      "셰이더 컴파일 1847/1847  완료",
    ],
  },
  {
    name: "지형 생성",
    seconds: 4.0,
    to: 45,
    ease: 0.9,
    logs: [
      "지형 청크 생성 512/4096",
      "지형 청크 생성 1984/4096",
      "강줄기 7개 배치, 하구 결정",
      "나무 41,209그루 심음",
      "지형 청크 생성 4096/4096",
      "계절: 늦여름으로 확정",
    ],
  },
  {
    name: "텍스처 스트리밍",
    seconds: 3.4,
    to: 62,
    ease: 1.0,
    logs: [
      "8K 텍스처 스트리밍 240MB / 1.9GB",
      "8K 텍스처 스트리밍 870MB / 1.9GB",
      "이끼 재질 밉맵 생성",
      "8K 텍스처 스트리밍 1.9GB / 1.9GB",
    ],
  },
  {
    name: "NPC 인격 주입",
    seconds: 3.2,
    to: 78,
    ease: 0.95,
    logs: [
      "NPC 인격 주입 311/1204",
      "대장장이에게 유년기를 부여했습니다",
      "NPC 인격 주입 806/1204",
      "여관 주인에게 후회 한 가지를 부여했습니다",
      "NPC 인격 주입 1204/1204",
    ],
  },
  {
    name: "물리·조명 예열",
    seconds: 3.0,
    to: 91,
    ease: 1.1,
    logs: [
      "광원 2,048개 베이킹",
      "옷감 시뮬레이션 예열",
      "낙엽 충돌 판정 캐시 구성",
      "중력 -9.80665 적용",
    ],
  },
  {
    name: "저작권 문구 확인",
    seconds: 1.6,
    to: 98,
    ease: 1.0,
    logs: ["폰트 라이선스 확인", "오픈소스 고지 3,411행 검토"],
  },
  {
    name: "마무리",
    seconds: 4.2,
    to: 99,
    ease: 1.0,
    logs: [
      "거의 다 됐습니다",
      "잠시만 더 기다려 주십시오",
      "정말 거의 다 됐습니다",
    ],
  },
  {
    name: "게임 시작 준비",
    seconds: 1.2,
    to: 100,
    ease: 1.0,
    logs: ["첫 장면으로 이동합니다"],
  },
];

const TIPS = [
  "로딩 중에 창을 닫아도 잃을 것은 없습니다.",
  "이 세계에는 아침이 옵니다. 보실 일은 없습니다.",
  "죽으면 마지막 모닥불에서 부활합니다. 모닥불도 없습니다.",
  "대화 중 아무 키나 누르면 대화가 빨라집니다.",
  "진행률 표시는 정확합니다. 그게 문제입니다.",
  "무기는 내구도가 있습니다. 쓰실 일은 없습니다.",
  "남은 시간은 실제로 남은 시간입니다.",
];

const TIP_MS = 4200;

type Cue = { at: number; text: string };
type Mark = {
  name: string;
  start: number;
  end: number;
  from: number;
  to: number;
  ease: number;
};

/** 일정표를 만든다. scale이 1보다 크면 그만큼 길어진다. */
function buildSchedule(scale: number): {
  cues: Cue[];
  marks: Mark[];
  total: number;
} {
  const cues: Cue[] = [];
  const marks: Mark[] = [];
  let at = 0;
  let from = 0;

  for (const phase of PHASES) {
    const dur = phase.seconds * 1000 * scale;
    marks.push({
      name: phase.name,
      start: at,
      end: at + dur,
      from,
      to: phase.to,
      ease: phase.ease,
    });
    phase.logs.forEach((text, i) => {
      cues.push({ at: at + (dur * i) / phase.logs.length + 30, text });
    });
    at += dur;
    from = phase.to;
  }

  return { cues, marks, total: at };
}

function markAt(marks: Mark[], ms: number): { mark: Mark; index: number } {
  for (let i = 0; i < marks.length; i += 1) {
    if (ms < marks[i].end) return { mark: marks[i], index: i };
  }
  return { mark: marks[marks.length - 1], index: marks.length - 1 };
}

function progressAt(marks: Mark[], ms: number): number {
  const last = marks[marks.length - 1];
  if (ms >= last.end) return 100;
  const { mark } = markAt(marks, ms);
  const t = Math.min(1, Math.max(0, (ms - mark.start) / (mark.end - mark.start)));
  return mark.from + (mark.to - mark.from) * Math.pow(t, mark.ease);
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/** 다시 로딩할수록 길어진다. 서비스입니다. */
function scaleFor(run: number): number {
  return Math.min(1 + (run - 1) * 0.35, 2.4);
}

export default function Game() {
  const [stage, setStage] = useState<"intro" | "loading" | "done">("intro");
  const [run, setRun] = useState(1);
  const [ms, setMs] = useState(0);
  const [injected, setInjected] = useState<Cue[]>([]);
  const [skips, setSkips] = useState(0);
  const [waitedMs, setWaitedMs] = useState(0);
  const [epilogue, setEpilogue] = useState(false);

  const frame = useRef<number | null>(null);
  const logBox = useRef<HTMLDivElement | null>(null);
  const epilogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { cues, marks, total } = useMemo(() => buildSchedule(scaleFor(run)), [run]);

  // 로딩은 실제 시간으로 흐른다. 배속도, 건너뛰기도 없다.
  useEffect(() => {
    if (stage !== "loading") return;

    const started = performance.now();
    let painted = -1;

    const tick = () => {
      const now = performance.now() - started;
      if (now >= total) {
        setMs(total);
        setStage("done");
        setWaitedMs((sum) => sum + total);
        return;
      }
      // 60fps로 다시 그릴 이유가 없어서 0.07초마다 그린다.
      if (now - painted >= 70) {
        painted = now;
        setMs(now);
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [stage, total]);

  // 다 끝난 뒤에 본편을 보여드려야 하는데, 없어서 한 박자만 쉰다.
  useEffect(() => {
    if (stage !== "done") return;
    epilogueTimer.current = setTimeout(() => setEpilogue(true), 1400);
    return () => {
      if (epilogueTimer.current) clearTimeout(epilogueTimer.current);
    };
  }, [stage]);

  const lines = useMemo(() => {
    const shown = [...cues, ...injected]
      .filter((c) => c.at <= ms)
      .sort((a, b) => a.at - b.at);
    return shown.slice(-7);
  }, [cues, injected, ms]);

  // 새 줄이 찍히면 콘솔을 아래로 붙인다.
  useEffect(() => {
    const box = logBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines.length]);

  function start() {
    setMs(0);
    setInjected([]);
    setEpilogue(false);
    setStage("loading");
  }

  function again() {
    setRun((n) => n + 1);
    setMs(0);
    setInjected([]);
    setEpilogue(false);
    setStage("loading");
  }

  function trySkip() {
    setSkips((n) => n + 1);
    setInjected((prev) => [
      ...prev,
      { at: ms + 1, text: "건너뛰기 요청을 받았습니다. 무시합니다" },
    ]);
  }

  if (stage === "intro") {
    return (
      <div className="flex min-h-[420px] flex-col items-center gap-8">
        <div className="w-full max-w-xl overflow-hidden rounded-xl border border-foreground/15">
          <div className="bg-gradient-to-b from-indigo-500/25 via-purple-500/10 to-transparent px-6 py-10 text-center">
            <p className="font-mono text-[11px] tracking-[0.3em] opacity-50">
              HARU ENGINE 4.2
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
              몰락한 왕국의
              <br />
              마지막 정원사
            </h2>
            <p className="mt-3 text-sm opacity-70">오픈월드 액션 RPG</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 border-t border-foreground/10 px-6 py-5 text-xs">
            {[
              "오픈월드 128km²",
              "실시간 물리",
              "8K 텍스처",
              "분기형 시나리오 200시간",
              "NPC 1,204명",
              "완전 한국어",
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-foreground/15 px-3 py-1 opacity-70"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="border-t border-foreground/10 px-6 py-5 text-center text-sm">
            <p className="font-bold">“올해의 게임. 9.8 / 10”</p>
            <p className="mt-1 text-xs opacity-50">— 이 문구는 저희가 직접 썼습니다</p>
          </div>
        </div>

        <button
          onClick={start}
          className="rounded-lg bg-foreground px-10 py-4 text-lg font-bold text-background transition-opacity hover:opacity-80"
        >
          게임 시작
        </button>

        <p className="max-w-md text-center text-xs opacity-50">
          최초 실행 시 리소스를 준비하는 데 시간이 걸립니다. 진행률은 정확하게
          표시되니 끝까지 기다려 주십시오.
        </p>
      </div>
    );
  }

  if (stage === "loading") {
    const pct = progressAt(marks, ms);
    const { mark, index } = markAt(marks, ms);
    const remain = Math.max(0, Math.ceil((total - ms) / 1000));
    const tip = TIPS[Math.floor(ms / TIP_MS) % TIPS.length];

    return (
      <div className="flex min-h-[420px] flex-col gap-6">
        <div className="rounded-xl border border-foreground/15 p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">{mark.name}</p>
            <p className="font-mono text-3xl font-bold tabular-nums">
              {Math.floor(pct)}%
            </p>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between font-mono text-xs opacity-60">
            <span>
              단계 {index + 1} / {marks.length}
            </span>
            <span className="tabular-nums">남은 시간 약 {remain}초</span>
          </div>
        </div>

        <div
          ref={logBox}
          className="h-[168px] overflow-hidden rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4 font-mono text-xs leading-6"
        >
          {lines.map((line, i) => (
            <p
              key={`${line.at}-${line.text}`}
              className={i === lines.length - 1 ? "opacity-90" : "opacity-40"}
            >
              <span className="opacity-50">›</span> {line.text}
            </p>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <p className="flex-1 opacity-70">
            <span className="mr-1 font-bold opacity-80">TIP</span>
            {tip}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-mono tabular-nums opacity-50">
            경과 {seconds(ms)}초
          </span>
          <button
            onClick={trySkip}
            className="rounded border border-foreground/15 px-3 py-1.5 opacity-60 transition-opacity hover:opacity-100"
          >
            건너뛰기
          </button>
        </div>
      </div>
    );
  }

  const nextScale = scaleFor(run + 1);

  return (
    <div className="flex min-h-[420px] flex-col items-center gap-8">
      <div className="flex min-h-[120px] w-full max-w-xl flex-col items-center justify-center rounded-xl border border-foreground/15 bg-foreground/[0.03] px-6 py-10 text-center">
        <p className="text-2xl font-bold">로딩이 완료되었습니다.</p>
        <p
          className={`mt-2 text-sm transition-opacity duration-700 ${
            epilogue ? "opacity-60" : "opacity-0"
          }`}
        >
          이상입니다.
        </p>
      </div>

      <div
        className={`flex w-full max-w-xl flex-col items-center gap-8 transition-opacity duration-700 ${
          epilogue ? "opacity-100" : "opacity-0"
        }`}
      >
        <dl className="w-full divide-y divide-foreground/10 rounded-lg border border-foreground/15 text-sm">
          {[
            ["로딩 시간", `${seconds(total)}초`],
            ["플레이 시간", "0.0초"],
            ["컴파일한 셰이더", "1,847개"],
            ["생성한 지형", "4,096청크"],
            ["인격을 받은 NPC", "1,204명"],
            ["건너뛰기 시도", `${skips}회`],
            ["진행도", "100%"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <dt className="opacity-60">{label}</dt>
              <dd className="font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="max-w-md text-center text-sm opacity-60">
          게임 본편은 준비되지 않았습니다. 로딩이 본편이었습니다. 다만 남은 시간
          표시는 정확했습니다. 그 점은 저희도 자랑스럽게 생각합니다.
        </p>

        <button
          onClick={again}
          className="rounded-lg border border-foreground/20 px-8 py-3 font-bold transition-opacity hover:opacity-70"
        >
          다시 로딩하기
        </button>

        <p className="max-w-md text-center text-xs opacity-50">
          지금까지 {run}번 로딩하셨고, 합계 {seconds(waitedMs)}초를 기다리셨습니다.
          다음 로딩은 {nextScale.toFixed(2)}배 걸립니다. 리소스가 늘어난 것은
          아닙니다.
        </p>
      </div>
    </div>
  );
}
