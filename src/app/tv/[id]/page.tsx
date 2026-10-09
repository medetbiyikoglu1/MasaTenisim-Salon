import { notFound } from "next/navigation";
import { AutoRefresh, Clock } from "@/components/AutoRefresh";
import { Bracket } from "@/components/Bracket";
import { TierBadge } from "@/components/tier";
import { Avatar, Scoreboard, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { ROUND_LABELS, assignTables, groupStandings, knockoutLabel, roundSize, type SetScore } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 10;

/** Salon TV'si için tam ekran, giriş gerektirmeyen, kendini yenileyen turnuva ekranı. */
export default async function TvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.tournament.findUnique({
    where: { id },
    include: {
      salon: true,
      prizes: { orderBy: { place: "asc" } },
      blocks: { include: { table: true }, orderBy: { table: { number: "asc" } } },
      participants: { include: { salonPlayer: { include: { player: true } } } },
      groups: { orderBy: { name: "asc" }, include: { participants: true } },
      matches: { orderBy: { order: "asc" }, include: { group: true } },
    },
  });
  if (!t) notFound();

  const names = new Map(t.participants.map((p) => [p.salonPlayerId, p.salonPlayer.player.name]));
  const name = (pid: string | null) => (pid ? names.get(pid) ?? "?" : "?");
  const elos = new Map(t.participants.map((p) => [p.salonPlayerId, p.salonPlayer.elo]));
  const eloOf = (pid: string) => elos.get(pid) ?? 0;
  const tables = [...new Map(t.blocks.map((b) => [b.tableId, b.table])).values()];
  const groupTable = new Map(t.groups.map((g) => [g.id, g.tableId]));

  // Masa ataması kalıcı tutulmuyor; kuyruk kurallarıyla şu anki öneri hesaplanır
  // Bay geçilen eleme maçları oynanmadığı için sayaca ve masa önerisine girmez
  const isBye = (m: (typeof t.matches)[number]) => m.status === "DONE" && (!m.playerAId || !m.playerBId);
  const active = t.matches.filter((m) => (t.status === "GROUPS" ? m.round === "GROUP" : m.round !== "GROUP") && !isBye(m));
  const assignments = assignTables(
    active.map((m) => ({
      id: m.id,
      // Elemede önce büyük turlar (çeyrek final, yarı final...) sıraya girer; 3.lük maçı final ile aynı sırada
      order: m.round === "GROUP" ? m.order : -roundSize(m.round === "3RD" ? "F" : m.round) * 100 + m.order,
      groupTableId: m.groupId ? groupTable.get(m.groupId) ?? null : null,
      playerAId: m.playerAId,
      playerBId: m.playerBId,
      status: m.status,
      tableId: m.tableId,
      finishedAt: m.finishedAt,
    })),
    tables.map((x) => x.id),
  );
  const onTable = new Map(assignments.map((a) => [a.tableId, t.matches.find((m) => m.id === a.matchId)!]));
  const assigned = new Set(assignments.map((a) => a.matchId));
  const queue = active.filter((m) => m.status === "PENDING" && m.playerAId && m.playerBId && !assigned.has(m.id)).slice(0, 6);
  const matchLabel = (m: (typeof t.matches)[number]) => (m.group ? `Grup ${m.group.name}` : knockoutLabel(m.round, m.bracket));
  const done = active.filter((m) => m.status === "DONE").length;

  const main = t.matches.filter((m) => m.round !== "GROUP" && m.bracket !== "CONSOLATION");
  const consolation = t.matches.filter((m) => m.bracket === "CONSOLATION");
  const final = main.find((m) => m.round === "F");
  const consolationFinal = consolation.find((m) => m.round === "F");

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-court-950 p-6 text-white xl:p-10">
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <header className="mb-8 flex flex-wrap items-center gap-6">
        <span className="block h-14 w-14 rounded-full bg-ball-500 shadow-[inset_-6px_-6px_0_rgba(0,0,0,0.15)]" />
        <div className="flex-1">
          <p className="text-lg font-medium tracking-widest text-court-100/70 uppercase">{t.salon.name}</p>
          <h1 className="mb-0 font-display text-5xl font-bold text-white xl:text-6xl">{t.name}</h1>
        </div>
        <div className="text-right">
          <div className="font-display text-6xl font-bold xl:text-7xl"><Clock /></div>
          <div className="mt-1 flex items-center justify-end gap-3 text-lg text-court-100/80">
            <StatusBadge status={t.status} />
            {active.length > 0 && <span className="tabular-nums">{done}/{active.length} maç</span>}
          </div>
        </div>
      </header>

      {t.status === "DRAFT" && (
        <p className="text-center font-display text-4xl text-court-100/80">Kayıtlar sürüyor · {t.participants.length} oyuncu</p>
      )}

      {(t.status === "GROUPS" || t.status === "KNOCKOUT") && (
        <div className="mb-10 grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section>
            <h2 className="mb-4 font-display text-2xl font-semibold tracking-wider text-court-100/70 uppercase">Masalarda</h2>
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {tables.map((table) => {
                const m = onTable.get(table.id);
                return (
                  <div key={table.id} className="relative overflow-hidden rounded-2xl bg-court-800 p-5 ring-1 ring-white/10">
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white/10" />
                    <div className="relative mb-3 flex items-center justify-between">
                      <span className="font-display text-3xl font-bold">Masa {table.number}</span>
                      {m && <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium">{matchLabel(m)}</span>}
                    </div>
                    {m ? (
                      <div className="relative space-y-2">
                        {[m.playerAId, m.playerBId].map((pid, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Avatar name={name(pid)} size="lg" />
                            <span className="truncate font-display text-3xl font-semibold">{name(pid)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="relative py-6 text-center text-xl text-court-100/50">Boş</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h2 className="mb-4 font-display text-2xl font-semibold tracking-wider text-court-100/70 uppercase">Sıradaki maçlar</h2>
            {queue.length === 0 ? (
              <p className="text-xl text-court-100/50">Bekleyen maç yok</p>
            ) : (
              <ol className="space-y-2">
                {queue.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                    <span className="font-display text-2xl font-bold text-ball-500">{i + 1}</span>
                    <span className="flex-1 truncate text-2xl font-medium">
                      {name(m.playerAId)} <span className="text-court-100/50">-</span> {name(m.playerBId)}
                    </span>
                    <span className="text-sm text-court-100/60">{matchLabel(m)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {t.status === "FINISHED" && (
        <section className="mb-10 flex flex-wrap items-end justify-center gap-6">
          {[1, 0, 2].map((i) => {
            const third = main.find((m) => m.round === "3RD");
            const loser = final && (final.winnerId === final.playerAId ? final.playerBId : final.playerAId);
            const pid = [final?.winnerId, loser, third?.winnerId][i];
            if (!pid) return null;
            const prize = t.prizes.find((p) => p.place === i + 1);
            return (
              <div key={i} className="flex w-64 flex-col items-center gap-2 text-center">
                <span className="text-6xl">{["🥇", "🥈", "🥉"][i]}</span>
                <span className="font-display text-4xl font-bold">{name(pid)}</span>
                {prize && <span className="text-lg text-court-100/70">{prize.name}</span>}
                <div className={`flex w-full items-start justify-center rounded-t-2xl pt-3 font-display text-5xl font-bold ${["h-48 bg-ball-500", "h-36 bg-court-700", "h-24 bg-court-700"][i]}`}>
                  {i + 1}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {t.status === "GROUPS" && (
        <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {t.groups.map((g) => {
            const finished = t.matches
              .filter((m) => m.groupId === g.id && m.status === "DONE" && m.playerAId && m.playerBId)
              .map((m) => ({ playerAId: m.playerAId!, playerBId: m.playerBId!, sets: m.sets as SetScore[] | null, walkoverWinnerId: m.walkover ? m.winnerId : null }));
            const rows = groupStandings(g.participants.map((p) => p.salonPlayerId), finished);
            return (
              <div key={g.id} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h2 className="mb-3 font-display text-3xl font-bold text-white">Grup {g.name}</h2>
                <table className="w-full text-xl">
                  <thead>
                    <tr className="text-left text-sm tracking-wider text-court-100/60 uppercase">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Oyuncu</th>
                      <th className="pb-2 text-right font-medium">G-M</th>
                      <th className="pb-2 text-right font-medium">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.playerId} className="border-t border-white/10">
                        <td className={`py-2 font-display text-2xl font-bold ${i < 2 ? "text-ball-500" : "text-court-100/50"}`}>{i + 1}</td>
                        <td className="py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <TierBadge elo={eloOf(r.playerId)} compact />
                            {name(r.playerId)}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-court-100/80">{r.wins}-{r.losses}</td>
                        <td className="py-2 text-right font-display text-2xl font-bold tabular-nums">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}

      {t.status === "FINISHED" && consolationFinal?.winnerId && (
        <p className="mb-8 text-center font-display text-3xl">
          🎖️ Teselli şampiyonu: <span className="font-bold text-sky-300">{name(consolationFinal.winnerId)}</span>
        </p>
      )}

      {[
        { key: "MAIN", title: "Eleme tablosu", matches: main, winner: final?.winnerId, champLabel: "Şampiyon", icon: "🏆", color: "bg-ball-500" },
        {
          key: "CONSOLATION",
          title: "Teselli turnuvası",
          matches: consolation,
          winner: consolationFinal?.winnerId,
          champLabel: "Teselli şampiyonu",
          icon: "🎖️",
          color: "bg-sky-500",
        },
      ]
        .filter((b) => b.matches.length > 0)
        .map((b) => (
          <section key={b.key} className="mb-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <h2 className="mb-4 font-display text-3xl font-bold text-white">{b.title}</h2>
            <Bracket
              dark
              championLabel={b.champLabel}
              columns={[...new Set(b.matches.filter((m) => m.round !== "3RD").map((m) => m.round))]
                .sort((x, y) => roundSize(y) - roundSize(x))
                .map((r) => ({
                  key: r,
                  label: ROUND_LABELS[r] ?? r,
                  matches: b.matches
                    .filter((m) => m.round === r)
                    .map((m) => ({
                      key: m.id,
                      node: (
                        <Scoreboard
                          a={m.playerAId ? { id: m.playerAId, name: name(m.playerAId) } : null}
                          b={m.playerBId ? { id: m.playerBId, name: name(m.playerBId) } : null}
                          sets={m.sets as SetScore[] | null}
                          winnerId={m.winnerId}
                          done={m.status === "DONE"}
                          walkover={m.walkover}
                          emptyLabel={m.status === "DONE" ? "bay" : "belli değil"}
                        />
                      ),
                    })),
                }))}
              champion={
                b.winner ? (
                  <div className={`flex w-full flex-col items-center gap-2 rounded-2xl py-5 text-white ${b.color}`}>
                    <span className="text-4xl">{b.icon}</span>
                    <span className="font-display text-2xl font-bold">{name(b.winner)}</span>
                  </div>
                ) : (
                  <div className="w-full rounded-2xl border-2 border-dashed border-white/20 py-6 text-center text-4xl opacity-50">{b.icon}</div>
                )
              }
            />
          </section>
        ))}
    </div>
  );
}
