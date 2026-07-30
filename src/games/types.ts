export type GameMeta = {
  /** URL 조각. /g/<slug> */
  slug: string;
  /** 며칠차인지. 1부터 시작, 중복 없음 */
  day: number;
  title: string;
  /** 한 줄 설명. 최대한 무성의할 것 */
  tagline: string;
  /** 공개일 YYYY-MM-DD */
  releasedAt: string;
  /** 쓸모없음 지수 1~5. 낮을수록 위험(쓸모가 있다는 뜻) */
  uselessness: 1 | 2 | 3 | 4 | 5;
};
