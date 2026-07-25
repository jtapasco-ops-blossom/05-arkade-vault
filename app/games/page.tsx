import { Library } from "@/components/Library";
import { getGames } from "@/lib/queries";

export default async function GamesPage() {
  const games = await getGames();
  return <Library games={games} />;
}
