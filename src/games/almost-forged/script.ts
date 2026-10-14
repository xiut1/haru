/**
 * 강화 확률표와 대장장이 대본.
 *
 * 확률표는 진짜다. 판정 주사위도 Math.random으로 진짜 굴린다.
 * 다만 판정에 성공하면 그다음 시공을 대장장이가 맡고, 대장장이는 매번 망친다.
 * 판정에 실패하면 원래 확률표대로 실패한다. 이때만 대장장이 탓이 아니다.
 */

/** 무기가 화면 어디에 있는지 */
export type Spot = "anvil" | "furnace" | "bucket" | "floor" | "air";

export type Fx = Partial<{
  w: Spot;
  heat: boolean;
  glow: boolean;
  /** 손잡이가 망치 쪽으로 가게 거꾸로 올렸다 */
  flipped: boolean;
  bent: boolean;
  /** false면 망치가 손을 떠났다 */
  hammer: boolean;
  cat: boolean;
  steam: boolean;
  fire: boolean;
  zzz: boolean;
}>;

export type Who = "smith" | "narr" | "sys";

/** 대장장이 표정. 안 적으면 장면을 보고 알아서 고른다 */
export type Face = "normal" | "focus" | "smug" | "uh" | "oops" | "sleep";

export type Line = {
  who: Who;
  text: string;
  face?: Face;
  fx?: Fx;
  /** 이 줄이 뜨는 동안 망치를 몇 번 내리치는지 */
  hits?: number;
};

export type Excuse = {
  id: string;
  /** 변명 도감에 적히는 이름 */
  title: string;
  /** 실패 후 무기 이름 앞에 붙는 말 */
  prefix?: string;
  /** 무기를 새 녹슨 단검으로 바꿔 줬다. 붙었던 말도 휜 것도 사라진다 */
  replace?: boolean;
  lines: () => Line[];
};

export type Row = {
  from: number;
  ok: number;
  keep: number;
  down: number;
  boom: number;
  cost: number;
  atk: number;
};

/** 강화 확률표. 하락은 +6부터, 파괴는 +10부터. 흔한 표다 */
export const TABLE: Row[] = [
  { from: 0, ok: 0.95, keep: 0.05, down: 0, boom: 0, cost: 100, atk: 3 },
  { from: 1, ok: 0.9, keep: 0.1, down: 0, boom: 0, cost: 150, atk: 5 },
  { from: 2, ok: 0.85, keep: 0.15, down: 0, boom: 0, cost: 220, atk: 8 },
  { from: 3, ok: 0.85, keep: 0.15, down: 0, boom: 0, cost: 320, atk: 12 },
  { from: 4, ok: 0.8, keep: 0.2, down: 0, boom: 0, cost: 470, atk: 17 },
  { from: 5, ok: 0.75, keep: 0.25, down: 0, boom: 0, cost: 700, atk: 23 },
  { from: 6, ok: 0.7, keep: 0, down: 0.3, boom: 0, cost: 1000, atk: 30 },
  { from: 7, ok: 0.65, keep: 0, down: 0.35, boom: 0, cost: 1500, atk: 38 },
  { from: 8, ok: 0.6, keep: 0, down: 0.4, boom: 0, cost: 2200, atk: 47 },
  { from: 9, ok: 0.55, keep: 0, down: 0.45, boom: 0, cost: 3300, atk: 57 },
  { from: 10, ok: 0.5, keep: 0, down: 0.47, boom: 0.03, cost: 5000, atk: 68 },
  { from: 11, ok: 0.45, keep: 0, down: 0.52, boom: 0.03, cost: 7500, atk: 80 },
  { from: 12, ok: 0.4, keep: 0, down: 0.54, boom: 0.06, cost: 11000, atk: 93 },
  { from: 13, ok: 0.35, keep: 0, down: 0.56, boom: 0.09, cost: 16000, atk: 107 },
  { from: 14, ok: 0.3, keep: 0, down: 0.58, boom: 0.12, cost: 24000, atk: 122 },
];

export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

const s = (text: string, fx?: Fx, hits?: number): Line => ({ who: "smith", text, fx, hits });
const n = (text: string, fx?: Fx): Line => ({ who: "narr", text, fx });
const uh = (l: Line): Line => ({ ...l, face: "uh" });
const oops = (l: Line): Line => ({ ...l, face: "oops" });
const smug = (l: Line): Line => ({ ...l, face: "smug" });

/** 거의 모든 대본이 이렇게 시작한다. 여기까지는 진짜 잘한다 */
function warmUp(): Line[] {
  return [
    s(pick(["일단 달구고요.", "불부터 넣겠습니다.", "화로 들어갑니다."]), {
      w: "furnace",
      heat: true,
    }),
    s(pick(["색 좋네요. 올립니다.", "딱 좋게 익었습니다.", "이 색이면 됩니다. 올리고요."]), {
      w: "anvil",
    }),
  ];
}

function strikes(times: number): Line {
  return s(Array.from({ length: times }, () => "땅!").join(" "), undefined, times);
}

export const EXCUSES: Excuse[] = [
  {
    id: "coffee",
    title: "아이스 아메리카노 담금질",
    prefix: "커피 향 나는",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("보이세요? 결이 살아납니다.", { glow: true }),
      s("이제 식히기만 하면 끝입니다. 치이이익—", { w: "bucket", steam: true, glow: false }),
      s("……"),
      oops(s("어, 이거 물 아니고 제 커피네요.")),
      s("아이스 아메리카노였습니다. 강화는 안 됐고 향은 좋습니다.", {
        heat: false,
        steam: false,
      }),
    ],
  },
  {
    id: "hammer",
    title: "망치 이탈",
    prefix: "식어 버린",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("됐다, 됐어요. 마지막 한 방만—", { glow: true }),
      s("으랏차!", { hammer: false }),
      oops(s("……망치 어디 갔죠?", { glow: false })),
      n("(대장장이가 망치를 찾으러 나갔다)"),
      n("(4분 뒤)", { heat: false }),
      s("찾았습니다. 옆집 지붕에 있더라고요.", { hammer: true }),
      s("근데 칼이 다 식었네요. 식으면 처음부터입니다. 규정이 그래요."),
    ],
  },
  {
    id: "handle",
    title: "손잡이 강화",
    prefix: "손잡이만 단단한",
    lines: () => [
      s("일단 달구고요.", { w: "furnace", heat: true }),
      s("올리고요.", { w: "anvil", flipped: true }),
      strikes(3),
      s("오오, 단단해진다. 이거 됩니다.", { glow: true }),
      uh(s("……잠깐만요. 손님, 칼날이 원래 이쪽이었나요?")),
      oops(s("손잡이를 강화했습니다.", { glow: false })),
      s("손잡이는 강화 대상이 아니라서 판정에 안 들어갑니다. 단단하긴 합니다."),
    ],
  },
  {
    id: "sneeze",
    title: "재채기",
    replace: true,
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("좋아요, 이제 마지막—", { glow: true }),
      uh(s("에… 에…")),
      uh(s("에…… 에에……")),
      oops(s("에취!", { w: "air", glow: false })),
      s("……어디로 갔죠?"),
      n("(창밖에서 「아야!」 소리가 났다)"),
      s("새 걸로 드릴게요. 녹슨 단검은 저희가 많습니다.", {
        w: "anvil",
        heat: false,
        bent: false,
      }),
    ],
  },
  {
    id: "neighbor",
    title: "옆집 손님 칼",
    prefix: "푹 익은",
    lines: () => [
      ...warmUp(),
      strikes(3),
      s("됐습니다! 이거 됐어요!", { glow: true }),
      s("축하드립니다, +1입니다! 손잡이 보세요, 이름까지 반짝이네요. 「김철수」."),
      uh(s("……손님 성함이 김철수세요?")),
      oops(s("옆집 손님 거네요. 손님 건 아직 화로에 있습니다.", { glow: false, w: "furnace" })),
      s("많이 익었네요."),
    ],
  },
  {
    id: "forge",
    title: "과도한 열정",
    prefix: "휜",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("느낌 왔습니다. 마지막은 진짜 세게 갑니다.", { glow: true }),
      s("흐읍— 땅!!!", { bent: true, glow: false }, 1),
      oops(s("……")),
      uh(s("이건 강화가 아니라 단조네요.")),
      s("단조는 저희 메뉴에 없어서 실패로 처리됩니다."),
    ],
  },
  {
    id: "anvil",
    title: "거꾸로 놓인 모루",
    prefix: "괜히 두들겨 맞은",
    lines: () => [
      ...warmUp(),
      strikes(3),
      s("이상하다, 소리가 왜 이렇게 둔하지."),
      s("그래도 빛 나죠? 됩니다 이거.", { glow: true }),
      oops(s("아.")),
      s("모루를 거꾸로 놨었네요. 어쩐지 위가 너무 평평하더라.", { glow: false }),
      s("거꾸로 놓고 한 건 전부 무효입니다."),
    ],
  },
  {
    id: "nap",
    title: "졸음",
    prefix: "침 묻은",
    lines: () => [
      ...warmUp(),
      s("땅……", undefined, 1),
      s("……땅……", undefined, 1),
      s("………", { zzz: true }),
      n("(대장장이가 망치를 든 채 잠들었다)"),
      n("(칼이 식는다)", { heat: false }),
      oops(s("헙. 안 잤습니다.", { zzz: false })),
      s("어디까지 했죠? 아, 식었으니 처음부터네요."),
    ],
  },
  {
    id: "cat",
    title: "고양이",
    prefix: "고양이 털 붙은",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("됐어요. 이제 이것만 식히면 +1—", { glow: true }),
      n("(고양이가 모루 위로 뛰어올랐다)", { cat: true }),
      uh(s("나비야, 거기 뜨거워…")),
      n("(고양이가 칼을 앞발로 툭 쳤다)", { w: "floor", glow: false }),
      n("(고양이는 아무 일 없었다는 듯 나갔다)", { cat: false }),
      s("바닥에 떨어진 건 부정 타서 다시 해야 합니다. 저희 집 규칙이에요."),
    ],
  },
  {
    id: "shine",
    title: "화로 불빛",
    prefix: "각도가 좋은",
    lines: () => [
      ...warmUp(),
      strikes(3),
      s("빛나죠? 이게 성공할 때 나는 빛입니다.", { glow: true }),
      s("이야, 오랜만에 보네요 이 빛."),
      s("……"),
      oops(s("아, 화로 불빛 반사네요.", { glow: false })),
      s("그냥 녹슨 칼이었습니다. 각도가 좋았어요."),
    ],
  },
  {
    id: "photo",
    title: "증빙 미비",
    prefix: "증빙 없는",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("됐습니다! 확실히 +1이에요!", { glow: true }),
      s("그럼 강화 전 사진이랑 비교해 볼게요. 손님, 아까 사진 찍으셨죠?"),
      uh(s("……안 찍으셨어요?")),
      s("그럼 전후 비교가 안 돼서 성공으로 처리를 못 해요.", { glow: false }),
      s("다음부턴 꼭 찍어 오세요."),
    ],
  },
  {
    id: "math",
    title: "산수",
    lines: () => [
      ...warmUp(),
      strikes(4),
      s("좋아요. 이제 +1입니다.", { glow: true }),
      uh(s("근데 제가 네 번 쳤나요, 다섯 번 쳤나요?")),
      s("다섯 번이면 한 번 더 친 거라 하나 빼야 되거든요."),
      s("+1에서 1 빼면……", { glow: false }),
      smug(s("+0이네요. 계산은 정확합니다.")),
    ],
  },
  {
    id: "oil",
    title: "기름 담금질",
    prefix: "그을린",
    lines: () => [
      ...warmUp(),
      strikes(2),
      s("이번엔 기름 담금질로 갑니다. 고급 기술이에요.", { glow: true }),
      s("치이이익—", { w: "bucket", glow: false, fire: true }),
      oops(s("……불붙었네요.")),
      oops(s("소화기 어디 있지.")),
      n("(치익)", { fire: false, steam: true }),
      s("다행히 칼은 멀쩡합니다. 강화도 멀쩡히 안 됐고요.", { heat: false, steam: false }),
    ],
  },
];

/** 판정 주사위가 실패를 띄웠을 때. 확률표의 5%. 대장장이가 유일하게 떳떳한 순간이다 */
export function honestFail(): Line[] {
  return [
    s("어? 판정이 실패 떴네요."),
    smug(s("그러니까 이번 건 제 탓이 아닙니다. 확률이 그런 거예요.")),
    s("……"),
    smug(s("아, 이 기분 좋네요. 다음에도 판정이 실패했으면 좋겠습니다.")),
  ];
}

export const OPENERS = [
  "오, 판정 성공 떴네요. 이제 제가 두드리기만 하면 됩니다.",
  "판정 성공입니다. 여기서부턴 제 손에 달렸습니다.",
  "판정 좋네요. 이 정도면 눈 감고도 합니다. 눈은 뜨고 하겠습니다.",
  "판정 붙었습니다. 오늘 컨디션 좋아요. 진짜로요.",
];

export const GREETING =
  "어서 오세요. 강화하시게요? 잘 오셨습니다. 저 이번 주 판정 운이 아주 좋습니다.";
