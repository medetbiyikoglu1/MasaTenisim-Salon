"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Özet" },
  { href: "/turnuvalar", label: "Turnuvalar" },
  { href: "/oyuncular", label: "Oyuncular" },
  { href: "/masalar", label: "Masalar" },
];

export function Nav() {
  const path = usePathname();
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
    </div>
  );
}
