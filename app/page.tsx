import { Home } from "@/components/Home";
import { getGames } from "@/lib/queries";

export default async function LandingPage() {
  const games = await getGames();
  return <Home games={games} />;
}
