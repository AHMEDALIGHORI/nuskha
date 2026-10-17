import type { Metadata } from "next";
import { Noto_Sans, Noto_Nastaliq_Urdu, Caveat } from "next/font/google";
import "./globals.css";

// Reason, written down (DESIGN.md): Noto Sans has full Urdu glyph coverage,
// true bold weights, and high legibility at the large sizes our elderly audience needs.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Authentic nastaliq for the wordmark and short Urdu headings.
const notoNastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-noto-nastaliq",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Nuskha (نسخہ) · Your prescription, understood",
  description:
    "Photograph a handwritten prescription. Hear what each medicine is for, in Urdu. Get warned about dangerous combinations and cheaper registered generics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${notoNastaliq.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
