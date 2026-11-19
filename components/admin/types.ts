export type Reel = 1 | 2 | 3;
export type Item = { id: number; reel: Reel; label: string; image_url: string | null; weight: number; active: boolean; sort_order: number };
/** One scripted spin as the server stores it. A null reel means "Random". */
export type ScriptRow = { reel1: number | null; reel2: number | null; reel3: number | null; enabled: boolean; note: string };
export type DraftRow = ScriptRow & { key: string };
export type Stats = {
  total: number;
  scripted: number;
  nextSpin: number;
  perItem: { id: number; reel: Reel; label: string; count: number }[];
  combos: { a: string; b: string; c: string; count: number }[];
  history: { id: number; seq: number; created_at: string; a: string; b: string; c: string; script_position: number | null }[];
};

export const REEL_KIND: Record<Reel, string> = { 1: "word", 2: "animal", 3: "word" };
export type Section = "reels" | "script" | "stats" | "settings";
/** The spin script screens are built but switched off for now. Set to true to bring the tab, the Next spin chip and the script stats back. */
export const SCRIPT_UI = false;
const ALL_SECTIONS: { id: Section; label: string; lede: string }[] = [
  { id: "reels", label: "Reels", lede: "What can appear on each reel, how likely it is, and in what order." },
  { id: "script", label: "Spin script", lede: "Decide the result of specific spins ahead of time. Anything left on Random is drawn as usual." },
  { id: "stats", label: "Stats & history", lede: "What the kiosk has produced so far." },
  { id: "settings", label: "Reset & settings", lede: "Clear the spin history and see how sign-in is set up." },
];
export const SECTIONS = ALL_SECTIONS.filter((s) => SCRIPT_UI || s.id !== "script");
export const isSection = (s: string): s is Section => SECTIONS.some((x) => x.id === s);
