import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MATCH_STATUS: Record<string, string> = {
  PENDING: "Bekliyor",
  ON_TABLE: "Masada",
  AWAITING_CONFIRMATION: "Onay bekliyor",
  DONE: "Bitti",
};

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.tournament.findUnique({
    where: { id },
    include: {
      prizes: { orderBy: { place: "asc" } },
      groups: {
        orderBy: { name: "asc" },
        include: {
          table: true,
          participants: { include: { salonPlayer: { include: { player: true } } }, orderBy: { seed: "asc" } },
          matches: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!t) notFound();
  const names = new Map(
    t.groups.flatMap((g) => g.participants.map((p) => [p.salonPlayerId, p.salonPlayer.player.name] as const)),
  );
  const matchCount = t.groups.reduce((s, g) => s + g.matches.length, 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1">{t.name}</h1>
        <p className="text-sm text-zinc-600">
          {t.startsAt.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })} -{" "}
          {t.endsAt.toLocaleTimeString("tr-TR", { timeStyle: "short" })} · {names.size} kişi · {t.groups.length} grup ·{" "}
          {matchCount} grup maçı · best of {t.bestOf}
          {t.entryFee && <> · katılım {t.entryFee.toString()} ₺</>}
        </p>
        {t.prizes.length > 0 && (
          <p className="text-sm text-zinc-600">Ödüller: {t.prizes.map((p) => `${p.place}. ${p.name}`).join(", ")}</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {t.groups.map((g) => (
          <section key={g.id} className="card">
            <h2>Grup {g.name} <span className="text-sm font-normal text-zinc-500">· Masa {g.table?.number ?? "-"}</span></h2>
            <ol className="mb-3 list-decimal pl-5 text-sm">
              {g.participants.map((p) => (
                <li key={p.id}>{p.salonPlayer.player.name} <span className="text-zinc-400">{p.salonPlayer.elo}</span></li>
              ))}
            </ol>
            <ul className="divide-y text-sm">
              {g.matches.map((m) => (
                <li key={m.id} className="flex justify-between py-1">
                  <span>{names.get(m.playerAId ?? "")} - {names.get(m.playerBId ?? "")}</span>
                  <span className="text-zinc-500">{MATCH_STATUS[m.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
