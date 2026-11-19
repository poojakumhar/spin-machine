// Placeholder data. Replace via /admin. Only seeds when reel_items is empty.
import { connect } from "./_db.mjs";

const db = await connect();
const [{ n }] = await db.query("SELECT count(*)::int AS n FROM reel_items");
if (n > 0) {
  console.log(`seed: skipped (${n} items exist)`);
  await db.close();
  process.exit(0);
}
const animals = ["Dog", "Bullock", "Horse", "Elephant", "Camel", "Goat", "Parrot", "Deer"];
const rows = [
  ...["Tiryanch", "Placeholder Word A", "Placeholder Word B"].map((l) => [1, l, null]),
  ...animals.map((l) => [2, l, ["Dog", "Bullock"].includes(l) ? `/reels/${l.toLowerCase()}.png` : `/reels/${l.toLowerCase()}.svg`]),
  ...["Parigrah", "Paradhinta", "Placeholder Word C"].map((l) => [3, l, null]),
];
let i = 0;
for (const [reel, label, img] of rows) {
  await db.query("INSERT INTO reel_items (reel,label,image_url,weight,active,sort_order) VALUES ($1,$2,$3,1,true,$4)", [reel, label, img, i++]);
}
console.log(`seed: inserted ${rows.length} placeholder items (${db.label})`);
await db.close();
