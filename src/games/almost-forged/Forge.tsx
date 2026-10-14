import type { Face, Spot } from "./script";

/**
 * 대장간 그림. 전부 SVG이고 움직임은 CSS transition뿐이다.
 * 대장간 안은 원래 어두우니 라이트 모드에서도 어둡게 그린다.
 */

export type Scene = {
  w: Spot;
  heat: boolean;
  glow: boolean;
  flipped: boolean;
  bent: boolean;
  hammer: boolean;
  cat: boolean;
  steam: boolean;
  fire: boolean;
  zzz: boolean;
};

/** 무기 위치. 무기는 원점 기준 가로로 그려져 있고 칼끝이 +x 쪽이다 */
const SPOT: Record<Spot, string> = {
  anvil: "translate(232px,124px) rotate(0deg) scale(1)",
  furnace: "translate(64px,184px) rotate(-8deg) scale(0.6)",
  bucket: "translate(436px,166px) rotate(90deg) scale(0.7)",
  floor: "translate(318px,218px) rotate(-5deg) scale(0.9)",
  air: "translate(580px,-120px) rotate(620deg) scale(1)",
};

/** 거꾸로 올리면 손잡이가 망치 밑에 오도록 왼쪽으로 민다 */
const FLIPPED_ON_ANVIL = "translate(200px,124px) rotate(180deg) scale(1)";

/** 망치 머리가 칼에 닿는 곳 */
const HIT = { x: 241, y: 118 };

/** 불똥이 날아가는 방향 */
const SPARKS = [
  [-38, -30],
  [-22, -46],
  [-4, -54],
  [16, -48],
  [34, -34],
  [46, -12],
  [-48, -8],
  [26, -60],
  [-30, -52],
];

/** 영광의 빛줄기. 12갈래 */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

/* ───────────────────────── 대장장이 얼굴 ───────────────────────── */

/** 원점이 얼굴 가운데, 반지름 20 남짓 */
export function Head({ face }: { face: Face }) {
  const ink = "#1c1917";
  return (
    <g>
      {/* 귀 */}
      <circle cx={-19} cy={2} r={4} fill="#e8b48f" />
      <circle cx={19} cy={2} r={4} fill="#e8b48f" />
      {/* 얼굴 */}
      <circle r={19} fill="#f1c7a1" />
      {/* 머리띠 */}
      <path d="M-19 -9 Q0 -17 19 -9 L19 -15 Q0 -24 -19 -15 Z" fill="#b91c1c" />
      <path d="M18 -13 L28 -18 L26 -9 Z M18 -12 L27 -4 L22 -2 Z" fill="#991b1b" />
      {/* 머리카락 */}
      <path d="M-17 -18 Q-6 -30 6 -27 Q16 -26 18 -18 Q8 -22 0 -21 Q-10 -21 -17 -18 Z" fill="#44403c" />

      {/* 눈썹 */}
      {face === "focus" && (
        <g stroke={ink} strokeWidth={2.2} strokeLinecap="round">
          <line x1={-11} y1={-8} x2={-3} y2={-5} />
          <line x1={11} y1={-8} x2={3} y2={-5} />
        </g>
      )}
      {(face === "uh" || face === "oops") && (
        <g stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M-11 -7 Q-7 -10 -3 -8" />
          <path d={face === "oops" ? "M3 -10 Q7 -13 11 -10" : "M3 -6 L11 -7"} />
        </g>
      )}
      {(face === "normal" || face === "smug") && (
        <g stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M-11 -7 Q-7 -9 -3 -7" />
          <path d="M3 -7 Q7 -9 11 -7" />
        </g>
      )}

      {/* 눈 */}
      {face === "normal" && (
        <g fill={ink}>
          <circle cx={-7} cy={-1} r={2} />
          <circle cx={7} cy={-1} r={2} />
        </g>
      )}
      {face === "focus" && (
        <g stroke={ink} strokeWidth={2.4} strokeLinecap="round">
          <line x1={-10} y1={-1} x2={-4} y2={-1} />
          <line x1={4} y1={-1} x2={10} y2={-1} />
        </g>
      )}
      {face === "smug" && (
        <g stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M-10 0 Q-7 -4 -4 0" />
          <path d="M4 0 Q7 -4 10 0" />
        </g>
      )}
      {face === "uh" && (
        <g fill={ink}>
          <circle cx={-7} cy={-1} r={1.5} />
          <circle cx={7} cy={-1} r={1.5} />
        </g>
      )}
      {face === "oops" && (
        <g>
          <circle cx={-7} cy={-1} r={3.6} fill="#fff" />
          <circle cx={7} cy={-1} r={3.6} fill="#fff" />
          <circle cx={-7} cy={-1} r={1.4} fill={ink} />
          <circle cx={7} cy={-1} r={1.4} fill={ink} />
        </g>
      )}
      {face === "sleep" && (
        <g stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M-10 -1 Q-7 2 -4 -1" />
          <path d="M4 -1 Q7 2 10 -1" />
        </g>
      )}

      {/* 볼 */}
      {face === "smug" && (
        <g fill="#f87171" opacity={0.45}>
          <ellipse cx={-12} cy={5} rx={4} ry={2.4} />
          <ellipse cx={12} cy={5} rx={4} ry={2.4} />
        </g>
      )}

      {/* 수염 */}
      <path
        d="M-18 3 Q-20 22 -6 27 Q0 30 6 27 Q20 22 18 3 Q14 9 8 10 Q0 7 -8 10 Q-14 9 -18 3 Z"
        fill="#57534e"
      />
      {/* 코 */}
      <ellipse cx={0} cy={5} rx={3.6} ry={3} fill="#dd9f7c" />

      {/* 입 */}
      {face === "normal" && <path d="M-4 15 Q0 17 4 15" stroke="#f1c7a1" strokeWidth={2} fill="none" strokeLinecap="round" />}
      {face === "focus" && <line x1={-4} y1={15} x2={4} y2={15} stroke="#f1c7a1" strokeWidth={2} strokeLinecap="round" />}
      {face === "smug" && <path d="M-6 13 Q0 20 6 13 Z" fill="#7f1d1d" />}
      {face === "uh" && (
        <path d="M-5 15 Q-2.5 13 0 15 Q2.5 17 5 15" stroke="#f1c7a1" strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
      {face === "oops" && <ellipse cx={0} cy={16} rx={3} ry={4} fill="#7f1d1d" />}
      {face === "sleep" && <ellipse cx={0} cy={15} rx={2} ry={1.6} fill="#7f1d1d" />}

      {/* 식은땀 */}
      {(face === "uh" || face === "oops") && (
        <path d="M17 -6 Q21 0 19 3 Q16 5 14 2 Q13 -1 17 -6 Z" fill="#7dd3fc" />
      )}
    </g>
  );
}

/* ───────────────────────── 단검 ───────────────────────── */

function Dagger({ scene }: { scene: Scene }) {
  const blade = scene.bent
    ? "M-22 -5.5 Q12 -6 32 -15 L49 -26 L42 -9 Q12 6 -22 5.5 Z"
    : "M-22 -5.5 L44 -5 L58 0 L44 5 L-22 5.5 Z";
  const fuller = scene.bent ? "M-18 0 Q10 0 30 -10" : "M-18 0 L38 0";

  return (
    <g
      style={{
        transform:
          scene.flipped && scene.w === "anvil"
            ? FLIPPED_ON_ANVIL
            : `${SPOT[scene.w]}${scene.flipped ? " rotate(180deg)" : ""}`,
        transformOrigin: "0px 0px",
        transition:
          scene.w === "air"
            ? "transform 750ms cubic-bezier(.2,.7,.3,1)"
            : "transform 600ms cubic-bezier(.45,0,.25,1)",
      }}
    >
      {/* 성공할 것 같은 후광 */}
      <g style={{ opacity: scene.glow ? 1 : 0, transition: "opacity 500ms" }}>
        <g
          className="animate-spin"
          style={{ animationDuration: "9s", transformOrigin: "8px 0px" }}
        >
          {RAYS.map((deg) => (
            <path
              key={deg}
              d="M8 0 L-2 -80 L18 -80 Z"
              fill="#fde68a"
              opacity={0.13}
              transform={`rotate(${deg} 8 0)`}
            />
          ))}
        </g>
        <ellipse cx={8} cy={0} rx={70} ry={18} fill="#facc15" filter="url(#af-blur)" opacity={0.85} />
      </g>

      {/* 손잡이 */}
      <rect x={-55} y={-4.5} width={31} height={9} rx={2.5} fill="#5b2c0e" />
      <g stroke="#3b1d08" strokeWidth={1.4}>
        {[-50, -44, -38, -32].map((x) => (
          <line key={x} x1={x} y1={-4.5} x2={x + 4} y2={4.5} />
        ))}
      </g>
      <circle cx={-58} cy={0} r={5.5} fill="url(#af-iron)" />
      {/* 코등이 */}
      <rect x={-27} y={-12} width={6} height={24} rx={2} fill="url(#af-iron)" />

      {/* 날: 차가운 쇠 위에 달군 색을 덮어서 서서히 바뀌게 */}
      <path d={blade} fill="url(#af-steel)" />
      <path d={blade} fill="url(#af-hot)" style={{ opacity: scene.heat ? 1 : 0, transition: "opacity 900ms" }} />
      <path d={fuller} stroke="#000" strokeOpacity={0.22} strokeWidth={1.4} fill="none" />
      <path
        d={scene.bent ? "M-22 -5.5 Q12 -6 32 -15 L49 -26" : "M-22 -5.5 L44 -5 L58 0"}
        stroke="#fff"
        strokeOpacity={scene.heat ? 0.5 : 0.35}
        strokeWidth={1}
        fill="none"
      />
      {/* 녹 */}
      <g fill="#9a3412" style={{ opacity: scene.heat ? 0 : 0.6, transition: "opacity 900ms" }}>
        <circle cx={-8} cy={-2.5} r={1.8} />
        <circle cx={-3} cy={2.6} r={1.1} />
        <circle cx={9} cy={2} r={2.3} />
        <circle cx={22} cy={-2} r={1.4} />
      </g>
    </g>
  );
}

/* ───────────────────────── 장면 ───────────────────────── */

export function Forge({
  scene,
  face,
  down,
  flash,
}: {
  scene: Scene;
  face: Face;
  down: boolean;
  flash: boolean;
}) {
  return (
    <svg viewBox="0 0 480 260" className="block w-full select-none" aria-hidden>
      <defs>
        <filter id="af-blur" x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="af-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <linearGradient id="af-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1917" />
          <stop offset="1" stopColor="#2a2421" />
        </linearGradient>
        <pattern id="af-brick" width="44" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 0.5 H44 M0 11.5 H44 M0.5 0 V11 M22.5 11 V22" stroke="#fff" strokeOpacity={0.045} />
        </pattern>
        <radialGradient id="af-fireglow" cx="64" cy="180" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f97316" stopOpacity={0.42} />
          <stop offset="0.45" stopColor="#ea580c" stopOpacity={0.12} />
          <stop offset="1" stopColor="#ea580c" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="af-coal" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.35" stopColor="#fb923c" />
          <stop offset="1" stopColor="#7c2d12" />
        </radialGradient>
        <linearGradient id="af-stone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#57534e" />
          <stop offset="0.5" stopColor="#4a4541" />
          <stop offset="1" stopColor="#3a3532" />
        </linearGradient>
        <linearGradient id="af-anvil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#71717a" />
          <stop offset="0.25" stopColor="#3f3f46" />
          <stop offset="1" stopColor="#18181b" />
        </linearGradient>
        <linearGradient id="af-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3a12" />
          <stop offset="0.5" stopColor="#92471a" />
          <stop offset="1" stopColor="#5c2a0c" />
        </linearGradient>
        <linearGradient id="af-steel" x1="0" y1="-6" x2="0" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e7e5e4" />
          <stop offset="0.5" stopColor="#a8a29e" />
          <stop offset="1" stopColor="#78716c" />
        </linearGradient>
        <linearGradient id="af-hot" x1="-22" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dc2626" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#fde047" />
        </linearGradient>
        <linearGradient id="af-iron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a1a1aa" />
          <stop offset="1" stopColor="#3f3f46" />
        </linearGradient>
      </defs>

      <g style={{ transform: flash ? "translateY(1.5px)" : "none" }}>
        {/* ── 벽과 바닥 ── */}
        <rect width={480} height={260} fill="url(#af-wall)" />
        <rect width={480} height={224} fill="url(#af-brick)" />
        <rect width={480} height={260} fill="url(#af-fireglow)" className="animate-pulse" style={{ animationDuration: "2.6s" }} />
        <rect y={222} width={480} height={38} fill="#0f0d0c" />
        <g stroke="#fff" strokeOpacity={0.05}>
          <line x1={0} y1={222.5} x2={480} y2={222.5} strokeOpacity={0.12} />
          <line x1={0} y1={238.5} x2={480} y2={238.5} />
          <line x1={90} y1={222} x2={70} y2={260} />
          <line x1={250} y1={222} x2={256} y2={260} />
          <line x1={400} y1={222} x2={430} y2={260} />
        </g>

        {/* 벽에 걸린 연장. 이 사람 것치고 너무 멀쩡하다 */}
        <g opacity={0.45}>
          <line x1={140} y1={18} x2={300} y2={18} stroke="#57534e" strokeWidth={3} />
          <g stroke="#78716c" strokeWidth={2.5} strokeLinecap="round">
            <line x1={160} y1={18} x2={160} y2={52} />
            <line x1={196} y1={18} x2={191} y2={48} />
            <line x1={276} y1={18} x2={276} y2={44} />
          </g>
          <rect x={152} y={50} width={16} height={8} rx={1} fill="#78716c" />
          <path d="M185 46 L197 46 L195 60 L187 60 Z" fill="#78716c" />
          <circle cx={276} cy={52} r={8} fill="none" stroke="#78716c" strokeWidth={2.5} />
        </g>
        {/* 「안전제일」. 지켜진 적 없음 */}
        <g opacity={0.7}>
          <rect x={418} y={66} width={46} height={28} rx={2} fill="#3f3a36" stroke="#57534e" />
          <text x={441} y={84} textAnchor="middle" fontSize={9} fill="#fbbf24" fontWeight={700}>
            안전제일
          </text>
        </g>

        {/* ── 화로 ── */}
        <rect x={46} y={0} width={36} height={64} fill="#2f2b28" />
        <path d="M22 62 L106 62 L116 94 L12 94 Z" fill="#3a3532" />
        <rect x={14} y={92} width={100} height={130} rx={4} fill="url(#af-stone)" />
        <g stroke="#000" strokeOpacity={0.25}>
          <path d="M14 120 H114 M14 150 H30 M98 150 H114 M14 180 H28 M100 180 H114 M14 208 H114" />
          <path d="M50 92 V120 M84 92 V120 M30 208 V222 M70 208 V222" />
        </g>
        <path d="M28 202 L28 160 A36 36 0 0 1 100 160 L100 202 Z" fill="#0c0a09" />
        <ellipse cx={64} cy={196} rx={34} ry={11} fill="url(#af-coal)" />
        <g fill="#fde047">
          <circle cx={48} cy={190} r={1.6} className="animate-pulse" />
          <circle cx={74} cy={188} r={1.3} className="animate-pulse" style={{ animationDelay: "0.6s" }} />
          <circle cx={84} cy={194} r={1.5} className="animate-pulse" style={{ animationDelay: "1.1s" }} />
        </g>
        <rect x={10} y={202} width={108} height={8} rx={2} fill="#292524" />

        {/* ── 모루 ── */}
        <rect x={190} y={186} width={84} height={36} rx={3} fill="url(#af-wood)" />
        <g stroke="#3b1d08" strokeOpacity={0.6} fill="none">
          <path d="M202 192 V218 M222 190 V220 M246 192 V220 M262 190 V216" />
        </g>
        <path
          d="M120 137 Q150 129 168 130 L292 130 L292 146 L268 150 Q256 154 256 166 L270 176 L272 187 L188 187 L190 176 L204 166 Q204 154 192 150 L168 146 Q146 145 120 137 Z"
          fill="url(#af-anvil)"
        />
        <path d="M122 136.5 Q150 129.5 168 130.5 L292 130.5" stroke="#d4d4d8" strokeOpacity={0.55} fill="none" />
        <rect x={274} y={133} width={8} height={5} fill="#09090b" />

        {/* ── 대장장이 ── */}
        <g>
          {/* 다리 */}
          <rect x={348} y={186} width={16} height={32} fill="#292524" />
          <rect x={372} y={186} width={16} height={32} fill="#292524" />
          <rect x={344} y={214} width={22} height={9} rx={3} fill="#1c1917" />
          <rect x={370} y={214} width={22} height={9} rx={3} fill="#1c1917" />
          {/* 몸 */}
          <path d="M338 120 Q368 106 398 120 L402 192 L334 192 Z" fill="#a8a29e" />
          {/* 앞치마 */}
          <path d="M346 132 L390 132 L394 196 L342 196 Z" fill="#78350f" />
          <path d="M346 132 L356 112 M390 132 L380 112" stroke="#78350f" strokeWidth={3} />
          <rect x={358} y={150} width={20} height={14} rx={2} fill="#5c2a0c" />
          {/* 놀고 있는 팔 */}
          <path d="M396 124 Q408 150 404 176" stroke="#a8a29e" strokeWidth={11} strokeLinecap="round" fill="none" />
          <circle cx={404} cy={178} r={6} fill="#f1c7a1" />
          {/* 망치 든 팔 */}
          <path d="M342 124 Q328 112 330 96" stroke="#a8a29e" strokeWidth={11} strokeLinecap="round" fill="none" />
          {/* 머리 */}
          <g transform="translate(368,84)">
            <Head face={face} />
          </g>
        </g>

        {/* ── 양동이 뒤쪽 테두리와 수면 ── */}
        <ellipse cx={436} cy={180} rx={30} ry={5} fill="#0e7490" />
        <ellipse cx={436} cy={181} rx={26} ry={3.5} fill="#38bdf8" opacity={0.7} />

        <Dagger scene={scene} />

        {/* ── 양동이 앞판. 칼이 담긴 것처럼 덮는다 ── */}
        <path d="M406 180 Q436 188 466 180 L460 222 L412 222 Z" fill="url(#af-wood)" />
        <g stroke="#3f3a36" strokeWidth={3}>
          <path d="M408 190 Q436 197 464 190" fill="none" />
          <path d="M411 213 Q436 219 461 213" fill="none" />
        </g>
        <g stroke="#3b1d08" strokeOpacity={0.5}>
          <line x1={424} y1={184} x2={426} y2={222} />
          <line x1={448} y1={184} x2={446} y2={222} />
        </g>

        {/* ── 화로 불길. 칼 위로 덮어서 안에 넣은 것처럼 ── */}
        <g className="animate-pulse" style={{ animationDuration: "1.4s" }}>
          <path d="M40 200 Q42 176 52 184 Q54 162 64 178 Q72 158 78 182 Q88 172 88 200 Z" fill="#f97316" opacity={0.85} />
          <path d="M50 200 Q54 184 60 190 Q64 174 70 190 Q76 182 78 200 Z" fill="#fde047" opacity={0.9} />
        </g>

        {/* ── 김 ── */}
        <g
          fill="none"
          stroke="#e7e5e4"
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#af-soft)"
          style={{
            opacity: scene.steam ? 0.7 : 0,
            transform: scene.steam ? "translateY(0px)" : "translateY(14px)",
            transition: "opacity 600ms, transform 900ms",
          }}
        >
          <path d="M420 170 q-7 -12 0 -24 q7 -12 0 -24" />
          <path d="M436 164 q-7 -12 0 -24 q7 -12 0 -24" />
          <path d="M452 170 q-7 -12 0 -24 q7 -12 0 -24" />
        </g>

        {/* ── 불 ── */}
        {/* animate-pulse가 opacity를 덮어쓰니 껐다 켜는 건 바깥 g에서 */}
        <g style={{ opacity: scene.fire ? 1 : 0, transition: "opacity 300ms" }}>
          <g className="animate-pulse" style={{ animationDuration: "0.7s" }}>
            <path d="M410 182 Q414 144 426 160 Q432 120 444 154 Q454 132 462 182 Z" fill="#f97316" />
            <path d="M422 182 Q426 160 434 168 Q440 146 448 182 Z" fill="#fde047" />
          </g>
        </g>

        {/* ── +1? ── */}
        <text
          x={232}
          y={92}
          textAnchor="middle"
          fontSize={24}
          fontWeight={800}
          fill="#fde047"
          stroke="#78350f"
          strokeWidth={4}
          paintOrder="stroke"
          style={{
            opacity: scene.glow ? 1 : 0,
            transform: scene.glow ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 400ms, transform 500ms cubic-bezier(.3,1.6,.5,1)",
          }}
        >
          +1?
        </text>

        {/* ── 고양이 ── */}
        <g
          style={{
            transform: scene.cat ? "translate(262px,130px)" : "translate(540px,130px)",
            transition: "transform 500ms cubic-bezier(.3,1.3,.5,1)",
          }}
        >
          <path d="M14 -10 Q30 -14 28 -34 Q26 -40 22 -36 Q24 -20 12 -16 Z" fill="#d97706" />
          <ellipse cx={2} cy={-11} rx={16} ry={11} fill="#f59e0b" />
          <circle cx={-12} cy={-24} r={10} fill="#f59e0b" />
          <path d="M-20 -30 L-19 -40 L-12 -33 Z M-6 -32 L-3 -41 L-2 -30 Z" fill="#f59e0b" />
          <g stroke="#b45309" strokeWidth={2} strokeLinecap="round">
            <line x1={0} y1={-21} x2={2} y2={-13} />
            <line x1={7} y1={-21} x2={8} y2={-13} />
          </g>
          <circle cx={-16} cy={-25} r={1.5} fill="#1c1917" />
          <circle cx={-9} cy={-25} r={1.5} fill="#1c1917" />
          <rect x={-10} y={-2} width={5} height={3} rx={1.5} fill="#f59e0b" />
          <rect x={6} y={-2} width={5} height={3} rx={1.5} fill="#f59e0b" />
        </g>

        {/* ── 망치. 대장장이 손(자루 끝)을 축으로 돈다 ── */}
        <g transform="translate(330,94)">
          <g
            style={{
              transform: !scene.hammer
                ? "translate(220px,-420px) rotate(-320deg)"
                : down
                  ? "rotate(-7deg)"
                  : "rotate(38deg)",
              transformOrigin: "0px 0px",
              transition: !scene.hammer
                ? "transform 850ms cubic-bezier(.2,.7,.3,1)"
                : down
                  ? "transform 80ms ease-in"
                  : "transform 240ms cubic-bezier(.3,1.4,.5,1)",
            }}
          >
            <rect x={-82} y={-3.5} width={88} height={7} rx={3} fill="url(#af-wood)" />
            <rect x={-102} y={-15} width={24} height={30} rx={3} fill="url(#af-iron)" />
            <rect x={-102} y={-15} width={4} height={30} rx={1.5} fill="#e4e4e7" opacity={0.5} />
          </g>
          {/* 손 */}
          {scene.hammer && <circle r={6.5} fill="#f1c7a1" />}
        </g>
        {!scene.hammer && <circle cx={330} cy={94} r={6.5} fill="#f1c7a1" />}

        {/* ── 불똥 ── */}
        <g transform={`translate(${HIT.x},${HIT.y})`}>
          <circle
            r={20}
            fill="#fde68a"
            filter="url(#af-blur)"
            style={{ opacity: flash ? 0.9 : 0, transition: flash ? "none" : "opacity 250ms" }}
          />
          {SPARKS.map(([dx, dy], i) => (
            <circle
              key={i}
              r={i % 3 === 0 ? 2 : 1.4}
              fill={i % 2 ? "#fde047" : "#fb923c"}
              style={{
                transform: flash ? "translate(0px,0px)" : `translate(${dx}px,${dy + 20}px)`,
                opacity: flash ? 1 : 0,
                transition: flash ? "none" : "transform 450ms cubic-bezier(.2,.8,.4,1), opacity 450ms ease-in",
              }}
            />
          ))}
          <text
            x={26}
            y={-30}
            fontSize={16}
            fontWeight={800}
            fill="#fde047"
            stroke="#7c2d12"
            strokeWidth={3}
            paintOrder="stroke"
            style={{ opacity: flash ? 1 : 0, transition: flash ? "none" : "opacity 350ms" }}
          >
            땅!
          </text>
        </g>

        {/* ── 졸음 ── */}
        <g fill="#e7e5e4" fontWeight={700} style={{ opacity: scene.zzz ? 0.8 : 0, transition: "opacity 500ms" }}>
          <text x={392} y={60} fontSize={10}>z</text>
          <text x={400} y={48} fontSize={13}>z</text>
          <text x={410} y={34} fontSize={17}>Z</text>
        </g>
      </g>
    </svg>
  );
}
