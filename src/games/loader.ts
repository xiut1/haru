import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * 게임 본체는 여기서만 import 한다.
 * 목록 페이지가 전 게임 코드를 통째로 끌어오지 않게 하려는 것.
 */
export const gameComponents: Record<string, ComponentType> = {
  "eternal-roulette": dynamic(() => import("./eternal-roulette/Game")),
  "untouchable-pinball": dynamic(() => import("./untouchable-pinball/Game")),
  "unmatchable-memory": dynamic(() => import("./unmatchable-memory/Game")),
  "late-rps": dynamic(() => import("./late-rps/Game")),
  "no-tetris": dynamic(() => import("./no-tetris/Game")),
  "all-mines": dynamic(() => import("./all-mines/Game")),
  "tiny-gomoku": dynamic(() => import("./tiny-gomoku/Game")),
  "only-o": dynamic(() => import("./only-o/Game")),
  "press-once": dynamic(() => import("./press-once/Game")),
  "loading-only": dynamic(() => import("./loading-only/Game")),
  "guess-seconds": dynamic(() => import("./guess-seconds/Game")),
  "unhittable-mole": dynamic(() => import("./unhittable-mole/Game")),
  "empty-lake": dynamic(() => import("./empty-lake/Game")),
};
