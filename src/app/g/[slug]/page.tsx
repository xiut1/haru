import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { games, getGame } from "@/games";
import { gameComponents } from "@/games/loader";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};
  return {
    title: `${game.day}일차 — ${game.title}`,
    description: game.tagline,
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = getGame(slug);
  const Game = gameComponents[slug];
  if (!game || !Game) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm opacity-60 hover:opacity-100">
        ← 전체 목록
      </Link>

      <header className="mb-10 mt-6">
        <p className="font-mono text-xs opacity-50">
          DAY {String(game.day).padStart(3, "0")} · {game.releasedAt}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{game.title}</h1>
        <p className="mt-2 opacity-70">{game.tagline}</p>
      </header>

      <Game />

      <footer className="mt-16 border-t border-foreground/15 pt-6 text-sm opacity-60">
        쓸모없음 지수 {"★".repeat(game.uselessness)}
        {"☆".repeat(5 - game.uselessness)}
      </footer>
    </main>
  );
}
