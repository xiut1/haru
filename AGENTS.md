<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# haru

하루에 하나씩 쓸모없는 미니게임을 추가하는 사이트. 프로젝트 전반은 `README.md`,
지금까지 만든 것과 아이디어 백로그는 `GAMES.md`.

## 톤

이 프로젝트에서 "좋은 결과물"은 **잘 만든 것이 아니라 어이없는 것**이다.
기능을 보태거나 사용자에게 도움을 주려 하지 말 것. 룰렛이 항상 「다시 돌리기」에
멈추는 게 버그가 아니라 기획이다.

제일 좋은 종류는 **아는 게임의 규칙을 완벽히 지키면서 핵심 하나만 빼서 구조적으로
클리어를 불가능하게** 만든 것이다(4×4 판 오목, 목표가 2047인 2048, 너비 9칸 테트리스).
이때 원본 게임 부분은 **진짜로 잘 굴러가야 한다.** 대충 만들면 그냥 미완성처럼 보이고
농담이 죽는다. 여기서만큼은 "30분 규칙"보다 완성도가 우선이다.
소재는 `GAMES.md` 백로그 A 섹션에서 꺼내 쓴다.

UI 문구는 전부 한국어. 존댓말이되 살짝 무례하게.

## 게임 추가 절차

`README.md`의 "새 게임 추가하기" 그대로. 요약하면 4곳:

- `src/games/<slug>/meta.ts` — `GameMeta`. `day`는 기존 최대값 +1, `slug`는 폴더명과 동일
- `src/games/<slug>/Game.tsx` — `"use client"`, `export default function Game()`, props 없음
- `src/games/index.ts` — meta import 후 `all` 배열에 추가
- `src/games/loader.ts` — slug → `dynamic(() => import(...))` 매핑 추가

그리고 `GAMES.md` 표에 한 줄. 백로그에서 꺼내 썼으면 그 항목은 지운다.

## 규칙

- `src/games/index.ts`는 메타데이터만 담는다. 게임 컴포넌트를 여기서 static import 하면
  목록 페이지가 전 게임 코드를 끌어온다. 컴포넌트 import는 `loader.ts`에서만.
- 게임 페이지 껍데기(제목/뒤로가기/쓸모없음 지수)는 `src/app/g/[slug]/page.tsx`가 그린다.
  게임 컴포넌트는 자기 제목을 다시 그리지 않는다.
- npm 의존성 추가 금지. 애니메이션은 CSS transition/transform으로, 상태는 useState로.
- 서버 코드·DB·API 라우트 없음. 전부 정적 생성이 유지돼야 한다.
- 색/여백은 Tailwind 유틸리티만. `foreground`/`background` 토큰을 써서 다크모드가 저절로 되게 한다.
- 작업 끝에 `npm run build`를 돌려 타입과 정적 생성이 통과하는지 확인한다.
