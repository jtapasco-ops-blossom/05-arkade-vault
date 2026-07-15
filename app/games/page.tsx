import { GAMES } from "@/lib/data";
import { Library } from "@/components/Library";

export default function GamesPage() {
  return <Library games={GAMES} />;
}
