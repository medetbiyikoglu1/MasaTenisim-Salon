import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masa Tenisi Salon",
  description: "Salon turnuvaları, ELO ve masa kiralama",
};

const NAV = [
  { href: "/", label: "Özet" },
  { href: "/turnuvalar", label: "Turnuvalar" },
  { href: "/oyuncular", label: "Oyuncular" },
  { href: "/masalar", label: "Masalar" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
            <span className="font-semibold">🏓 Masa Tenisi Salon</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-zinc-600 hover:text-zinc-900">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
