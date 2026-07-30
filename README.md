# 하루 (haru)

하루에 하나씩, **아무 쓸모 없는 것**을 만들어 올리는 사이트.

잘 만드는 게 목표가 아니다. 어이없는 게 목표다.
룰렛인데 결과가 항상 「다시 돌리기」인 것 정도가 기준선이다.

## 원칙

1. **하나에 30분.** 오래 걸리면 그건 이미 쓸모가 있는 것이다.
2. **설명이 필요 없어야 한다.** 들어오자마자 버튼 하나 누르면 끝.
3. **정직하게 쓸모없을 것.** 사용자를 속이지는 않는다. 다만 도움도 주지 않는다.
4. **의존성 추가 금지.** React + Tailwind로 안 되면 그건 너무 야심찬 기획이다.
5. **깨지지는 말 것.** 어이없음과 버그는 다르다.
6. **완성 못 해도 올린다.** 매일 하나가 규칙이지 매일 잘 만들기가 규칙은 아니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 전 게임 정적 생성
npm run lint
```

## 스택

- Next.js 16 (App Router) / React 19 / TypeScript
- Tailwind CSS v4
- 배포: Vercel (전부 정적, 서버 없음, DB 없음)

## 구조

```
src/
├─ app/
│  ├─ page.tsx            # 전체 목록 (최신순)
│  └─ g/[slug]/page.tsx   # 게임 한 개 페이지 (공통 껍데기)
└─ games/
   ├─ types.ts            # GameMeta 타입
   ├─ index.ts            # meta 모음. 목록 페이지가 이것만 읽는다
   ├─ loader.ts           # slug → 게임 컴포넌트 (dynamic import)
   └─ <slug>/
      ├─ meta.ts          # 제목, 며칠차, 공개일, 쓸모없음 지수
      └─ Game.tsx         # 본체. "use client"
```

목록 페이지는 `games/index.ts`(메타데이터)만 읽고, 게임 코드는 `loader.ts`의
dynamic import로만 들어온다. 게임이 300개가 돼도 첫 화면은 가볍다.

## 새 게임 추가하기

1. `src/games/<slug>/meta.ts` 작성 — `day`는 마지막 게임 +1, `slug`는 폴더명과 동일.
2. `src/games/<slug>/Game.tsx` 작성 — 최상단 `"use client"`, `export default function Game()`.
   props 없음. 껍데기(제목/뒤로가기/푸터)는 `/g/[slug]`가 그려주니 본체만 신경 쓴다.
3. `src/games/index.ts`에 meta import 후 `all` 배열에 추가.
4. `src/games/loader.ts`에 `"<slug>": dynamic(() => import("./<slug>/Game"))` 추가.
5. `GAMES.md`에 한 줄 기록.
6. `npm run build`로 확인.

새 파일 4곳을 건드리는 게 전부다. 라우팅은 자동.

## 기록

지금까지 뭘 올렸는지, 다음에 뭘 할 건지는 [GAMES.md](./GAMES.md).
