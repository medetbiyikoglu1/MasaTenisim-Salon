import Link from "next/link";
import { Avatar, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const salon = await currentSalon();
  const [tables, players, tournaments, top] = await Promise.all([
    db.table.count({ where: { salonId: salon.id, active: true } }),
    db.salonPlayer.count({ where: { salonId: salon.id } }),
    db.tournament.findMany({
      where: { salonId: salon.id },
      include: { _count: { select: { participants: true } } },
      orderBy: { startsAt: "desc" },
      take: 5,
    }),
    db.salonPlayer.findMany({ where: { salonId: salon.id }, include: { player: true }, orderBy: { elo: "desc" }, take: 5 }),
  ]);
  const stat = "rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:border-court-600 hover:shadow-md";
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-court-800 px-6 py-8 text-white shadow-md">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white/10" />
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/10" />
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-ball-500/90 shadow-[inset_-10px_-10px_0_rgba(0,0,0,0.12)]" />
        <p className="relative text-sm font-medium tracking-wider text-court-100 uppercase">Hoş geldin</p>
        <h1 className="relative mb-0 text-white">{salon.name}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/masalar" className={stat}>
          <div className="font-display text-4xl font-bold text-court-800">{tables}</div>
          <div className="text-sm text-zinc-600">aktif masa</div>
        </Link>
        <Link href="/oyuncular" className={stat}>
          <div className="font-display text-4xl font-bold text-court-800">{players}</div>
          <div className="text-sm text-zinc-600">oyuncu</div>
        </Link>
        <Link href="/maclar" className={`${stat} bg-court-800! text-white hover:bg-court-700!`}>
          <div className="font-display text-4xl font-bold">🏓</div>
          <div className="text-sm text-court-100">maç gir</div>
        </Link>
        <Link href="/turnuvalar/yeni" className={`${stat} bg-ball-500! text-white hover:bg-ball-600!`}>
          <div className="font-display text-4xl font-bold">+</div>
          <div className="text-sm text-ball-50">yeni turnuva</div>
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="card">
          <h2>Son turnuvalar</h2>
          {tournaments.length === 0 && <p className="text-sm text-zinc-600">Henüz turnuva yok.</p>}
          <ul className="divide-y divide-zinc-100">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/turnuvalar/${t.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="text-xs text-zinc-500">
                      {t.startsAt.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} · {t._count.participants} oyuncu
                    </span>
                  </span>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>ELO liderleri</h2>
          <ol className="space-y-1">
            {top.map((p, i) => (
              <li key={p.id}>
                <Link href={`/oyuncular/${p.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-zinc-50">
                  <span className="w-5 text-center text-sm">{["🥇", "🥈", "🥉"][i] ?? <span className="text-zinc-400">{i + 1}</span>}</span>
                  <Avatar name={p.player.name} size="sm" />
                  <span className="flex-1 truncate text-sm font-medium">{p.player.name}</span>
                  <span className="font-display text-lg font-bold tabular-nums">{p.elo}</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href="/oyuncular" className="mt-3 block text-sm font-medium text-court-700 hover:underline">Tüm sıralama →</Link>
        </section>
      </div>
    </div>
  );
}
