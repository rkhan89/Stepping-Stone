import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Caveat } from "next/font/google";
import "./globals.css";
import { RunProvider } from "@/lib/session";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-heading",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stepping Stone",
  description: "Stop researching. Start doing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${figtree.variable} ${caveat.variable} h-full`}
    >
      <body className="min-h-full">
        <RunProvider>{children}</RunProvider>
      </body>
    </html>
  );
}
