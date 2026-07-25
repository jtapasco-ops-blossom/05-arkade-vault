import { HallOfFame } from "@/components/HallOfFame";
import { getGames, getScores } from "@/lib/queries";

export default async function SalonPage() {
  const [games, scores] = await Promise.all([getGames(), getScores()]);
  return <HallOfFame games={games} scores={scores} />;
}
