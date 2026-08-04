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
};
