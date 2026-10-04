import Link from "next/link";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/ui";
import { currentSalon } from "@/lib/salon";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const salon = await currentSalon();
  const tournaments = await db.tournament.findMany({
    where: { salonId: salon.id },
    include: { _count: { select: { participants: true } } },
    orderBy: { startsAt: "desc" },
  });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="mb-0">Turnuvalar</h1>
        <Link href="/turnuvalar/yeni" className="btn btn-accent">+ Yeni turnuva</Link>
      </div>
      {tournaments.length === 0 && <p className="card text-sm text-zinc-600">Henüz turnuva yok.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`/turnuvalar/${t.id}`}
              className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition hover:border-court-600 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-court-800 text-white">
                <span className="font-display text-2xl leading-none font-bold">{t.startsAt.getDate()}</span>
                <span className="text-[10px] font-medium tracking-wider uppercase">
                  {t.startsAt.toLocaleDateString("tr-TR", { month: "short" })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-semibold">{t.name}</div>
                <div className="text-sm text-zinc-500">
                  {t.startsAt.toLocaleDateString("tr-TR", { weekday: "long" })} {t.startsAt.toLocaleTimeString("tr-TR", { timeStyle: "short" })} ·{" "}
                  {t._count.participants} oyuncu
                </div>
              </div>
              <StatusBadge status={t.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
