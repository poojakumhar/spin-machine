import { Montserrat } from "next/font/google";
import TestSlot from "@/components/TestSlot";
import "./test.css";

const montserrat = Montserrat({ weight: ["600", "700"], subsets: ["latin"], display: "swap" });

export const metadata = { title: "Slot Machine – Test" };

export default function Page() {
  return (
    <div className={`tsm-page ${montserrat.className}`}>
      <TestSlot />
    </div>
  );
}
