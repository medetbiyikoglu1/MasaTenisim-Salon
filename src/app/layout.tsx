import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const heading = Barlow_Condensed({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Masa Tenisi Salon",
  description: "Salon turnuvaları, ELO ve masa kiralama",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-screen bg-zinc-100/70 text-zinc-900 antialiased">
        <header className="bg-court-900 shadow-md">
          {/* Masanın orta çizgisi */}
          <nav className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative block h-7 w-7 rounded-full bg-ball-500 shadow-[inset_-3px_-3px_0_rgba(0,0,0,0.15)]" />
              <span className="font-display text-xl font-semibold tracking-wide text-white uppercase">Masa Tenisi Salon</span>
            </Link>
            <Nav />
          </nav>
          <div className="h-1 bg-gradient-to-r from-white/0 via-white/70 to-white/0" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
