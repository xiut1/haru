import type { Tier } from "./data";

/**
 * 누적 기록. 브라우저에만 남는다.
 * 정적 HTML에는 기록이 없으므로 첫 페인트는 0으로 그리고,
 * 하이드레이션이 끝난 뒤 실제 값으로 한 번 더 그린다.
 */

const KEY = "haru:zero-percent";

export type Stats = {
  /** 뽑은 카드 장수 */
  total: number;
  /** 뽑기 횟수. 10연차는 1회로 센다 */
  draws: number;
  byTier: Record<Tier, number>;
  /** 기둥 색으로 나온 등급별 횟수 */
  byBeam: Record<Tier, number>;
  /** 캐릭터별 보유 수 */
  owned: Record<string, number>;
  /** 중복분을 바꿔 드리는 각성 재료 */
  shards: number;
};

export const EMPTY: Stats = {
  total: 0,
  draws: 0,
  byTier: { 5: 0, 4: 0, 3: 0 },
  byBeam: { 5: 0, 4: 0, 3: 0 },
  owned: {},
  shards: 0,
};

function read(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      total: parsed.total ?? 0,
      draws: parsed.draws ?? 0,
      byTier: { ...EMPTY.byTier, ...parsed.byTier },
      byBeam: { ...EMPTY.byBeam, ...parsed.byBeam },
      owned: parsed.owned ?? {},
      shards: parsed.shards ?? 0,
    };
  } catch {
    // 저장소를 막아 두셨다면 이번 방문 동안만 기억하겠습니다.
    return EMPTY;
  }
}

function write(stats: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // 위와 같습니다.
  }
}

function wipe() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 위와 같습니다.
  }
}

/**
 * 정적 HTML에는 기록이 없다. 서버 스냅샷은 EMPTY로 두고,
 * 하이드레이션이 끝난 뒤 실제 값으로 한 번 다시 그린다.
 * 스냅샷은 참조가 그대로 유지돼야 하므로 모듈 스코프에 캐시해 둔다.
 */
let cached: Stats | null = null;
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): Stats {
  if (cached === null) cached = read();
  return cached;
}

export function getServerSnapshot(): Stats {
  return EMPTY;
}

/** 기록하고 구독자에게 알린다 */
export function commit(next: Stats) {
  cached = next;
  write(next);
  for (const fn of listeners) fn();
}

export function reset() {
  cached = EMPTY;
  wipe();
  for (const fn of listeners) fn();
}
