import { GAMES } from "@/lib/data";
import { Library } from "@/components/Library";

export default function Home() {
  return <Library games={GAMES} />;
}
