import Machine from "@/components/Machine";
import { GEO2 } from "@/components/frame2";

// Test machine: the clean three-reel drum (reference/ref-3-drum.png) with the same reels, labels, animals and backend as "/".
export default function Page() {
  return <Machine geo={GEO2} />;
}
