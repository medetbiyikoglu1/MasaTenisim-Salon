import Link from "next/link";
import { getSession, requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { LevelPicker, TierBadge, TierIcon } from "@/components/tier";
import { Avatar, EloDelta } from "@/components/ui";
import { TIERS, tierMax } from "@/lib/tiers";
import { currentSalon } from "@/lib/salon";
import { LEVELS, addSalonPlayer } from "@/lib/services/player";
import { PROVISIONAL_MATCHES } from "@/lib/tournament";

export const dynamic = "force-dynamic";

async function addPlayer(formData: FormData) {
  "use server";
  await requireAdmin();
  const salon = await currentSalon();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await addSalonPlayer(salon.id, { name, email: String(formData.get("email") ?? ""), level: String(formData.get("level")) });
  revalidatePath("/oyuncular");
}

export default async function PlayersPage() {
  const salon = await currentSalon();
  const { admin, playerId } = await getSession();
  const players = await db.salonPlayer.findMany({
    where: { salonId: salon.id },
    include: { player: true, eloHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { elo: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1>{admin ? "Oyuncular ve ELO sıralaması" : "Puan durumu"}</h1>
      {admin && <form action={addPlayer} className="card space-y-4">
        <div className="flex flex-wrap gap-3">
          <div><label className="label">Ad soyad</label><input name="name" required className="input" /></div>
          <div><label className="label">E-posta (giriş için)</label><input name="email" type="email" className="input" /></div>
        </div>
        <LevelPicker levels={LEVELS} />
        <button className="btn btn-accent">Oyuncu ekle</button>
      </form>}
      <TierLegend />
      <section className="card p-0">
        <ol className="divide-y divide-zinc-100">
          {players.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/oyuncular/${p.id}`}
                className={`flex items-center gap-3 px-4 py-3 transition hover:bg-court-50 ${p.id === playerId ? "bg-court-50 ring-2 ring-court-600 ring-inset" : i < 3 ? "bg-gradient-to-r from-ball-50 to-transparent" : ""}`}
              >
                <span className={`w-7 text-center font-display text-lg font-bold ${i < 3 ? "text-ball-600" : "text-zinc-400"}`}>
                  {["🥇", "🥈", "🥉"][i] ?? i + 1}
                </span>
                <Avatar name={p.player.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.player.name}</span>
                    <TierBadge elo={p.elo} />
                    {p.id === playerId && <span className="rounded-full bg-court-700 px-2 text-[10px] font-semibold text-white uppercase">sen</span>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {p.matchesCount} maç
                    {p.matchesCount < 5 && <span className="ml-2 rounded bg-ball-100 px-1.5 text-ball-600">geçici</span>}
                    {p.matchesCount < PROVISIONAL_MATCHES && p.matchesCount >= 5 && <span className="ml-2 text-zinc-400">oturuyor</span>}
                  </div>
                </div>
                <EloDelta delta={p.eloHistory[0]?.delta} />
                <span className="w-14 text-right font-display text-xl font-bold tabular-nums">{p.elo}</span>
                <span className="text-zinc-300">›</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Kademelerin ELO aralıkları ve ikonları. */
function TierLegend() {
  return (
    <section className="card">
      <h2>Kademeler</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {TIERS.map((t) => (
          <span key={t.key} className="flex items-center gap-1.5">
            <TierIcon tier={t} size={22} />
            <span className="font-semibold">{t.name}</span>
            <span className="text-xs tabular-nums text-zinc-500">
              {t.min === 0 ? `< ${TIERS[1].min}` : tierMax(t) === null ? `${t.min}+` : `${t.min}-${tierMax(t)}`}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
