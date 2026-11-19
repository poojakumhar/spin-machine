// LOCAL TESTING ONLY (LOCAL_DB=1): fills the local database with 8+ items per reel, a spin script and some history,
// so the admin can be checked with realistic data. Never run against Neon.
import { connect, schemaSql } from "./_db.mjs";

if (process.env.LOCAL_DB !== "1") throw new Error("dev-fill only runs with LOCAL_DB=1");
const db = await connect();
await db.exec(schemaSql());
await db.exec("DELETE FROM spin_script; DELETE FROM spins; DELETE FROM settings; DELETE FROM reel_items;");
const words1 = ["Tiryanch", "Manushya", "Deva", "Naraka", "Pashu", "Kirat", "Vanar", "Sarpa", "Matsya"];
const animals = ["Dog", "Bullock", "Horse", "Elephant", "Camel", "Goat", "Parrot", "Deer"];
const words3 = ["Parigrah", "Paradhinta", "Aparigrah", "Sanyam", "Tyaga", "Vairagya", "Santosh", "Daan", "Seva"];
const ids = { 1: [], 2: [], 3: [] };
const add = async (reel, label, img, w, active, o) => {
  const [r] = await db.query("INSERT INTO reel_items (reel,label,image_url,weight,active,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [reel, label, img, w, active, o]);
  ids[reel].push(r.id);
};
for (const [i, l] of words1.entries()) await add(1, l, null, i === 2 ? 3 : 1, i !== 5, i);
for (const [i, l] of animals.entries()) await add(2, l, ["Dog", "Bullock"].includes(l) ? `/reels/${l.toLowerCase()}.png` : `/reels/${l.toLowerCase()}.svg`, 1, true, i);
for (const [i, l] of words3.entries()) await add(3, l, null, i === 1 ? 2 : 1, true, i);
const pick = (r, k) => ids[r][k % ids[r].length];
const script = [
  [0, 1, 0, "Opening spin for the stage demo"], [2, 0, 1, ""], [null, 3, null, "Elephant, rest random"], [1, 1, 2, ""],
  [null, null, null, "Free spin"], [3, 4, 4, "VIP table"], [4, 6, 5, ""], [0, 2, 3, "Last of the batch"],
];
for (const [i, [a, b, c, note]] of script.entries()) {
  await db.query("INSERT INTO spin_script (position,reel1_item_id,reel2_item_id,reel3_item_id,enabled,note) VALUES ($1,$2,$3,$4,$5,$6)",
    [i + 1, a === null ? null : pick(1, a), b === null ? null : pick(2, b), c === null ? null : pick(3, c), i !== 6, note]);
}
// 3 played spins (the first two followed the script)
const lab = async (id) => (await db.query("SELECT label FROM reel_items WHERE id=$1", [id]))[0].label;
const played = [[pick(1, 0), pick(2, 1), pick(3, 0), 1], [pick(1, 2), pick(2, 0), pick(3, 1), 2], [pick(1, 4), pick(2, 5), pick(3, 7), null]];
for (const [a, b, c, sp] of played) {
  await db.query("INSERT INTO spins (reel1_item_id,reel2_item_id,reel3_item_id,reel1_label,reel2_label,reel3_label,script_position,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval)",
    [a, b, c, await lab(a), await lab(b), await lab(c), sp, String(30 - 7 * (sp ?? 3))]);
}
console.log("dev-fill: ok");
await db.close();
