import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/GamePlayer";
import { getGame } from "@/lib/queries";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) notFound();

  return <GamePlayer game={game} />;
}
