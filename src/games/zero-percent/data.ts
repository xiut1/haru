/**
 * 가챠의 데이터와 추첨 로직.
 *
 * 추첨 코드에는 아무 장난도 들어 있지 않다. 확률표를 위에서부터 누적해
 * 난수와 비교하는 흔한 구현이고, ★5 풀도 ★4 풀도 멀쩡히 존재하며
 * 뽑히면 도감에 정상적으로 등록된다.
 *
 * 다만 RATES에 적힌 ★5와 ★4의 확률이 0이다. 화면에 고지된 값과 정확히
 * 같은 값이다. 그래서 저 경로는 실행되지 않는다.
 */

export type Tier = 3 | 4 | 5;

export type Element = "불" | "물" | "바람" | "땅" | "빛" | "어둠";

export const ELEMENTS: Element[] = ["불", "물", "바람", "땅", "빛", "어둠"];

export type Char = {
  id: string;
  name: string;
  tier: Tier;
  element: Element;
  note: string;
};

/** 고지된 확률표. 화면에 그대로 출력된다 */
export const RATES: { tier: Tier; rate: number }[] = [
  { tier: 5, rate: 0 },
  { tier: 4, rate: 0 },
  { tier: 3, rate: 1 },
];

/**
 * 기둥 색은 이번 뽑기의 최고 등급을 그대로 따른다. 따로 추첨하지 않는다.
 * ★5면 금빛, ★4면 무지개, ★3이면 회색이다.
 */
export const BEAM_LABEL: Record<Tier, string> = {
  5: "금빛",
  4: "무지개",
  3: "회색",
};

export const CHARS: Char[] = [
  // ★5 — 도감에 자리는 있습니다
  { id: "astra", name: "천공의 검성 아스트라", tier: 5, element: "빛", note: "하늘을 갈랐다고 전해집니다." },
  { id: "nox", name: "심연의 지배자 녹스", tier: 5, element: "어둠", note: "심연 쪽 사정은 알려진 바 없습니다." },
  { id: "rizel", name: "성좌의 여왕 리제르", tier: 5, element: "바람", note: "별자리를 다스린다고 합니다." },
  { id: "bahar", name: "종말의 용 바하르", tier: 5, element: "불", note: "종말은 아직 오지 않았습니다." },
  { id: "chronoa", name: "시간의 관측자 크로노아", tier: 5, element: "물", note: "관측만 합니다." },
  { id: "elysion", name: "빛의 대현자 엘리시온", tier: 5, element: "빛", note: "현명하다고 합니다." },

  // ★4 — 여기도 자리는 있습니다
  { id: "reina", name: "폭풍의 검 레이나", tier: 4, element: "바람", note: "폭풍까지는 아니고 바람입니다." },
  { id: "gild", name: "강철 기사 길드", tier: 4, element: "땅", note: "무겁습니다." },
  { id: "sera", name: "심해의 무녀 세라", tier: 4, element: "물", note: "심해에 가 본 적은 없습니다." },
  { id: "volk", name: "화염술사 볼크", tier: 4, element: "불", note: "불을 냅니다. 끄지는 못합니다." },
  { id: "lumen", name: "새벽의 사제 루멘", tier: 4, element: "빛", note: "새벽에 일어납니다." },
  { id: "vane", name: "그림자 추적자 베인", tier: 4, element: "어둠", note: "따라다닙니다." },
  { id: "torr", name: "대지의 수호자 토르", tier: 4, element: "땅", note: "서 있습니다." },
  { id: "iris", name: "빙결의 무희 이리스", tier: 4, element: "물", note: "춤을 춥니다. 얼지는 않습니다." },

  // ★3 — 실제로 나오는 것들
  { id: "aren", name: "견습 검사 아렌", tier: 3, element: "불", note: "검을 배우고 있습니다. 아직입니다." },
  { id: "rine", name: "마을 사제 리네", tier: 3, element: "빛", note: "상처를 조금 낫게 합니다. 조금입니다." },
  { id: "kyle", name: "떠돌이 궁수 카일", tier: 3, element: "바람", note: "활은 있습니다." },
  { id: "dohyun", name: "수련생 권사 도현", tier: 3, element: "땅", note: "주먹이 단단한 편입니다." },
  { id: "mir", name: "하급 정령술사 미르", tier: 3, element: "물", note: "정령이 가끔 말을 듣습니다." },
  { id: "boro", name: "야간 경비 보로", tier: 3, element: "어둠", note: "밤에 서 있습니다." },
  { id: "celi", name: "초보 연금술사 셀리", tier: 3, element: "불", note: "폭발하면 성공입니다." },
  { id: "hun", name: "시장 상인 훈", tier: 3, element: "땅", note: "물건을 팝니다. 이 게임에는 상점이 없습니다." },
  { id: "roan", name: "견습 기사 로안", tier: 3, element: "빛", note: "방패를 들 수 있습니다." },
  { id: "taro", name: "어부 타로", tier: 3, element: "물", note: "물고기는 못 잡았습니다." },
  { id: "nika", name: "신입 도적 니카", tier: 3, element: "어둠", note: "주머니를 뒤집니다. 비어 있습니다." },
  { id: "fay", name: "동네 마법사 페이", tier: 3, element: "바람", note: "동네에서는 알아줍니다." },
];

export const byTier = (tier: Tier) => CHARS.filter((c) => c.tier === tier);
export const findChar = (id: string) => CHARS.find((c) => c.id === id);

/** 확률표를 위에서부터 누적해 고른다. 특별할 것 없는 구현이다 */
export function rollTier(): Tier {
  const r = Math.random();
  let acc = 0;
  for (const row of RATES) {
    acc += row.rate;
    if (r < acc) return row.tier;
  }
  // 확률 합이 1에 못 미칠 때의 안전망. 여기까지 올 일은 없다
  return RATES[RATES.length - 1].tier;
}

/** 이번 뽑기의 최고 등급. 기둥 색은 이 값을 그대로 쓴다 */
export function bestTier(got: Char[]): Tier {
  let best: Tier = 3;
  for (const c of got) if (c.tier > best) best = c.tier;
  return best;
}

/** 1회 뽑기 기준 속성 분포. 풀에서 직접 센다 */
export const ELEMENT_RATES: { element: Element; rate: number }[] = ELEMENTS.map((e) => {
  const pool = CHARS.filter((c) => c.tier === 3);
  return { element: e, rate: pool.filter((c) => c.element === e).length / pool.length };
});

/** 한 번 뽑는다 */
export function pull(): Char {
  const pool = byTier(rollTier());
  return pool[Math.floor(Math.random() * pool.length)];
}

export const TIER_LABEL: Record<Tier, string> = {
  5: "★★★★★",
  4: "★★★★",
  3: "★★★",
};

export const ELEMENT_COLOR: Record<Element, string> = {
  불: "text-orange-400",
  물: "text-sky-400",
  바람: "text-emerald-400",
  땅: "text-amber-500",
  빛: "text-yellow-300",
  어둠: "text-violet-400",
};
