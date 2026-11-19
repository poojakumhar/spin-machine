// Offline preview (/?demo=1): fake API so the kiosk can be previewed without a database.
import type { Cell } from "./Reel";

const animals = ["Dog", "Bullock", "Horse", "Elephant", "Camel", "Goat", "Parrot", "Deer"];
const all: (Cell & { reel: number })[] = [
  ...([["Tiryanch", null], ["Placeholder Word A", null], ["Placeholder Word B", null]] as [string, string | null][]).map(([label, image_url], i) => ({ id: 1 + i, reel: 1, label, image_url })),
  ...animals.map((label, i) => ({ id: 10 + i, reel: 2, label, image_url: `/reels/${label.toLowerCase()}.${label === "Dog" || label === "Bullock" ? "png" : "svg"}` })),
  ...([["Parigrah", null], ["Paradhinta", null], ["Placeholder Word C", null]] as [string, string | null][]).map(([label, image_url], i) => ({ id: 30 + i, reel: 3, label, image_url })),
];
const rnd = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

export const demoItems = () => all;
export function demoSpin() {
  const by = [1, 2, 3].map((n) => all.filter((i) => i.reel === n));
  return { spinId: Date.now(), result: by.map(rnd), decoys: by.map((l) => Array.from({ length: 8 }, () => rnd(l))) };
}
