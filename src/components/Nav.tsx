"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export const ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Özet" },
  { href: "/turnuvalar", label: "Turnuvalar" },
  { href: "/maclar", label: "Maçlar" },
  { href: "/oyuncular", label: "Oyuncular" },
  { href: "/masalar", label: "Masalar" },
];

export const PLAYER_NAV: NavItem[] = [
  { href: "/oyuncu", label: "Özetim" },
  { href: "/turnuvalar", label: "Turnuvalar" },
  { href: "/oyuncular", label: "Puan durumu" },
];

export function Nav({ items, showLogout }: { items: NavItem[]; showLogout: boolean }) {
  const path = usePathname();
  const NAV = items;
  return (
    <div className="flex flex-wrap gap-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-white/15 text-white" : "text-court-100/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
      {showLogout && (
        <a href="/cikis" className="rounded-md px-3 py-1.5 text-sm font-medium text-court-100/60 transition hover:bg-white/10 hover:text-white">
          Çıkış
        </a>
      )}
    </div>
  );
}
