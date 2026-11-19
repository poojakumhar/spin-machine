import type { Metadata, Viewport } from "next";
import { Rozha_One, Cormorant_Garamond, Poppins } from "next/font/google";
import "./globals.css";
import "./face.css";

const display = Rozha_One({ weight: "400", subsets: ["latin", "devanagari"], variable: "--font-display", display: "block" });
const word = Poppins({ weight: "600", subsets: ["latin"], variable: "--font-word", display: "block" });
const body = Cormorant_Garamond({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = { title: "Slot Machine" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${word.variable}`}>
      <body>{children}</body>
    </html>
  );
}
