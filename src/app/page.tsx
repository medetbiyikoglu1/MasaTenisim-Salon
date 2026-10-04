import Link from "next/link";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const salon = await currentSalon();
  const [tables, players, tournaments] = await Promise.all([
    db.table.count({ where: { salonId: salon.id, active: true } }),
    db.salonPlayer.count({ where: { salonId: salon.id } }),
    db.tournament.findMany({ where: { salonId: salon.id }, orderBy: { startsAt: "desc" }, take: 5 }),
  ]);
  return (
    <div className="space-y-6">
      <h1>{salon.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/masalar" className="card"><div className="text-3xl font-semibold">{tables}</div><div className="text-sm text-zinc-600">aktif masa</div></Link>
        <Link href="/oyuncular" className="card"><div className="text-3xl font-semibold">{players}</div><div className="text-sm text-zinc-600">oyuncu</div></Link>
        <Link href="/turnuvalar/yeni" className="card"><div className="text-3xl font-semibold">+</div><div className="text-sm text-zinc-600">yeni turnuva</div></Link>
      </div>
      <section className="card">
        <h2>Son turnuvalar</h2>
        {tournaments.length === 0 && <p className="text-sm text-zinc-600">Henüz turnuva yok.</p>}
        <ul className="divide-y">
          {tournaments.map((t) => (
            <li key={t.id} className="py-2">
              <Link href={`/turnuvalar/${t.id}`} className="hover:underline">{t.name}</Link>
              <span className="ml-2 text-sm text-zinc-500">{t.startsAt.toLocaleString("tr-TR")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
