import Link from "next/link";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DRAFT: "Taslak", GROUPS: "Grup aşaması", KNOCKOUT: "Eleme", FINISHED: "Bitti" };

export default async function TournamentsPage() {
  const salon = await currentSalon();
  const tournaments = await db.tournament.findMany({
    where: { salonId: salon.id },
    include: { _count: { select: { participants: true } } },
    orderBy: { startsAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="mb-0">Turnuvalar</h1>
        <Link href="/turnuvalar/yeni" className="btn">Yeni turnuva</Link>
      </div>
      <ul className="card divide-y">
        {tournaments.length === 0 && <li className="py-2 text-sm text-zinc-600">Henüz turnuva yok.</li>}
        {tournaments.map((t) => (
          <li key={t.id} className="flex justify-between py-2">
            <Link href={`/turnuvalar/${t.id}`} className="hover:underline">{t.name}</Link>
            <span className="text-sm text-zinc-500">
              {t.startsAt.toLocaleDateString("tr-TR")} · {t._count.participants} kişi · {STATUS[t.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
