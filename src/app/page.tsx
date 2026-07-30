import Link from "next/link";

import { games } from "@/games";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <header className="mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">하루</h1>
        <p className="mt-3 text-lg opacity-70">
          하루에 하나씩, 아무 쓸모 없는 것을 만들어 올립니다.
        </p>
        <p className="mt-1 text-sm opacity-50">
          현재 {games.length}개. 재미는 보장하지 않습니다.
        </p>
      </header>

      <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
        {games.map((game) => (
          <li key={game.slug}>
            <Link
              href={`/g/${game.slug}`}
              className="group flex items-baseline gap-4 py-6 transition hover:opacity-60"
            >
              <span className="font-mono text-xs opacity-40">
                {String(game.day).padStart(3, "0")}
              </span>
              <span className="flex-1">
                <span className="block text-xl font-bold group-hover:underline">
                  {game.title}
                </span>
                <span className="mt-1 block text-sm opacity-60">{game.tagline}</span>
              </span>
              <span className="font-mono text-xs opacity-40">{game.releasedAt}</span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="mt-16 text-sm opacity-40">
        <p>내일 또 하나 올라옵니다. 아마도.</p>
      </footer>
    </main>
  );
}
