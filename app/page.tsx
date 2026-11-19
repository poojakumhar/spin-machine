import Machine from "@/components/Machine";
import { GEO2 } from "@/components/frame2";

// Kiosk: the clean three-reel drum (reference/ref-3-drum.png, layout in components/frame2.ts).
// To switch back to the first-version drum, render <Machine /> (it defaults to GEO1 from components/frame.ts).
export default function Page() {
  return <Machine geo={GEO2} />;
}
