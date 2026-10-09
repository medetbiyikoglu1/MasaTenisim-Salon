import Link from "next/link";
import { ErrorNote } from "@/components/ErrorNote";
import { PlayerProfile } from "@/components/PlayerProfile";
import { StatusBadge } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { changeEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlayerHome({ searchParams }: { searchParams: Promise<{ hata?: string; tamam?: string }> }) {
  const { hata, tamam } = await searchParams;
  const { playerId } = await getSession();
  const me = playerId ? await db.salonPlayer.findUnique({ where: { id: playerId } }) : null;

  if (!me) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6 text-center">
        <h1>Oyuncu girişi</h1>
        {hata === "gecersiz" && <ErrorNote message="Bu bağlantı geçersiz ya da yenilenmiş. Salon sahibinden yeni bağlantı iste." />}
        <p className="card text-sm text-zinc-600">
          Kendi sayfanı görmek için salon sahibinden <b>kişisel bağlantını</b> iste. Bağlantıyı bir kez açman yeterli; bu telefonda
          girişin açık kalır.
        </p>
      </div>
    );
  }

  const tournaments = await db.tournament.findMany({
    where: { salonId: me.salonId, status: { in: ["DRAFT", "GROUPS", "KNOCKOUT"] } },
    include: { _count: { select: { participants: true } }, participants: { where: { salonPlayerId: me.id } } },
    orderBy: { startsAt: "asc" },
  });
  const open = tournaments.filter((t) => t.status === "DRAFT");
  const live = tournaments.filter((t) => t.status !== "DRAFT" && t.participants.length > 0);
  const when = (d: Date) => d.toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <PlayerProfile id={me.id} greeting="Merhaba 👋" recentLimit={10}>
        <ErrorNote message={hata} />
        {tamam && <p className="rounded-md border border-court-600/30 bg-court-50 px-3 py-2 text-sm text-court-800">{tamam}</p>}

        {live.length > 0 && (
          <section className="card border-ball-500/40">
            <h2>Oynadığın turnuva</h2>
            <ul className="space-y-2">
              {live.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 font-medium">{t.name}</span>
                  <StatusBadge status={t.status} />
                  <Link href={`/turnuvalar/${t.id}`} className="btn btn-accent">Tabloyu gör</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Kayıt açık turnuvalar</h2>
          {open.length === 0 ? (
            <p className="text-sm text-zinc-600">Şu an kaydı açık turnuva yok.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {open.map((t) => {
                const joined = t.participants.length > 0;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-48 flex-1">
                      <Link href={`/turnuvalar/${t.id}`} className="font-display text-lg font-semibold hover:underline">{t.name}</Link>
                      <div className="text-xs text-zinc-500">
                        {when(t.startsAt)} · {t._count.participants} oyuncu
                        {t.entryFee && ` · katılım ${t.entryFee.toString()} ₺`}
                      </div>
                    </div>
                    {joined && <span className="rounded-full bg-court-100 px-2.5 py-0.5 text-xs font-semibold text-court-800">✓ Katılıyorsun</span>}
                    <form action={changeEntry}>
                      <input type="hidden" name="tournamentId" value={t.id} />
                      <input type="hidden" name="islem" value={joined ? "cekil" : "katil"} />
                      <button className={joined ? "btn btn-ghost" : "btn btn-accent"}>{joined ? "Katılımı geri çek" : "Katıl"}</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </PlayerProfile>
    </div>
  );
}
