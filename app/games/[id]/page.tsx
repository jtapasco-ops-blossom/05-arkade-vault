import { notFound } from "next/navigation";
import { GameDetail } from "@/components/GameDetail";
import { getGame, getScores } from "@/lib/queries";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) notFound();

  const scores = await getScores(id, 10);

  return <GameDetail game={game} scores={scores} />;
}
