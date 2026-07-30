import type { GameMeta } from "./types";

import { meta as day001 } from "./eternal-roulette/meta";

/** 새 게임을 만들면 여기에 meta 하나만 추가하면 된다. */
const all: GameMeta[] = [day001];

/** 최신순 */
export const games: GameMeta[] = [...all].sort((a, b) => b.day - a.day);

export const latestGame: GameMeta = games[0];

export function getGame(slug: string): GameMeta | undefined {
  return games.find((g) => g.slug === slug);
}
