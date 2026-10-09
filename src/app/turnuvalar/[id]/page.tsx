import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import { Bracket } from "@/components/Bracket";
import { LevelPicker, TierBadge } from "@/components/tier";
import { Avatar, EloDelta, Scoreboard, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { LEVELS, addSalonPlayer } from "@/lib/services/player";
import {
  MIN_PARTICIPANTS,
  TournamentError,
  addParticipants,
  removeParticipant,
  finishGroupStage,
  startTournament,
} from "@/lib/services/tournament";
import { ROUND_LABELS, groupStandings, roundSize, type SetScore } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/** Servis işlemini çalıştırır; doğrulama hatasını sayfada göstermek için `?hata=` ile geri döner. */
async function run(id: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TournamentError) redirect(`/turnuvalar/${id}?hata=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(`/turnuvalar/${id}`);
  redirect(`/turnuvalar/${id}`);
}

async function addExisting(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await run(id, () => addParticipants(id, formData.getAll("players").map(String)));
}

async function addNew(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  await run(id, async () => {
    if (!name) throw new TournamentError("Oyuncu adı boş olamaz");
    const t = await db.tournament.findUniqueOrThrow({ where: { id } });
    const sp = await addSalonPlayer(t.salonId, { name, email: String(formData.get("email") ?? ""), level: String(formData.get("level")) });
    await addParticipants(id, [sp.id]);
  });
}

async function remove(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await run(id, () => removeParticipant(id, String(formData.get("participantId"))));
}

async function start(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await run(id, () => startTournament(id));
}

async function finishGroups(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await run(id, () => finishGroupStage(id));
}

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const t = await db.tournament.findUnique({
    where: { id },
    include: {
      prizes: { orderBy: { place: "asc" } },
      blocks: { include: { table: true }, orderBy: { table: { number: "asc" } } },
      participants: { include: { salonPlayer: { include: { player: true } } }, orderBy: { salonPlayer: { elo: "desc" } } },
      groups: {
        orderBy: { name: "asc" },
        include: {
          table: true,
          participants: { include: { salonPlayer: { include: { player: true } } }, orderBy: { seed: "asc" } },
          matches: { orderBy: { order: "asc" }, include: { eloHistory: true } },
        },
      },
      matches: { where: { groupId: null }, orderBy: { order: "asc" }, include: { eloHistory: true } },
    },
  });
  if (!t) notFound();
  if (t.status === "DRAFT") return <DraftTournament t={t} hata={hata} />;
  const names = new Map(
    t.groups.flatMap((g) => g.participants.map((p) => [p.salonPlayerId, p.salonPlayer.player.name] as const)),
  );
  const groupMatches = t.groups.flatMap((g) => g.matches);
  const left = groupMatches.filter((m) => m.status !== "DONE").length;
  const editable = (m: { round: string; playerAId: string | null; playerBId: string | null }) =>
    !!m.playerAId && !!m.playerBId && (m.round === "GROUP" ? t.status === "GROUPS" : t.status === "KNOCKOUT");
  const board = (m: (typeof groupMatches)[number]) => {
    const side = (pid: string | null) =>
      pid ? { id: pid, name: names.get(pid) ?? "?", delta: m.eloHistory.find((h) => h.salonPlayerId === pid)?.delta } : null;
    const bye = m.status === "DONE" && (!m.playerAId || !m.playerBId);
    const canEdit = editable(m);
    return (
      <Scoreboard
        key={m.id}
        a={side(m.playerAId)}
        b={side(m.playerBId)}
        sets={m.sets as SetScore[] | null}
        winnerId={m.winnerId}
        done={m.status === "DONE"}
        walkover={m.walkover}
        emptyLabel={bye ? "bay" : "belli değil"}
        href={canEdit ? `/turnuvalar/${t.id}/mac/${m.id}` : undefined}
        action={canEdit && m.status !== "DONE" ? "Sonuç gir" : undefined}
        title={canEdit && m.status === "DONE" ? "Sonucu düzelt" : undefined}
      />
    );
  };

  const mainMatches = t.matches.filter((m) => m.bracket !== "CONSOLATION");
  const consolationMatches = t.matches.filter((m) => m.bracket === "CONSOLATION");
  const final = mainMatches.find((m) => m.round === "F");
  const third = mainMatches.find((m) => m.round === "3RD");
  const consolationFinal = consolationMatches.find((m) => m.round === "F");
  const loserOf = (m?: typeof final) => (m?.winnerId ? (m.winnerId === m.playerAId ? m.playerBId : m.playerAId) : null);
  // Eleme ve teselli tablosuna çıkanlar: o tablonun maçlarında yer alan herkes
  const playersOf = (ms: typeof t.matches) => new Set(ms.flatMap((m) => [m.playerAId, m.playerBId]).filter((x): x is string => !!x));
  const qualified = playersOf(mainMatches);
  const consoled = playersOf(consolationMatches);
  const podium = t.status === "FINISHED" ? [final?.winnerId, loserOf(final), third?.winnerId] : [];
  // Eleme tablosu sütunları: turlar büyükten küçüğe (3.lük maçı ayrı gösterilir)
  const columns = (ms: typeof t.matches) =>
    [...new Set(ms.map((m) => m.round))]
      .filter((r) => r !== "3RD")
      .sort((x, y) => roundOrder(y) - roundOrder(x))
      .map((r) => ({
        key: r,
        label: ROUND_LABELS[r] ?? r,
        matches: ms.filter((m) => m.round === r).map((m) => ({ key: m.id, node: board(m) })),
      }));
  const done = groupMatches.length - left;

  return (
    <div className="space-y-6">
      <Hero
        t={t}
        facts={[
          `${names.size} oyuncu`,
          `${t.groups.length} grup`,
          `best of ${t.bestOf}`,
          ...(t.consolation ? ["teselli turnuvalı"] : []),
          ...(t.entryFee ? [`katılım ${t.entryFee.toString()} ₺`] : []),
        ]}
      />
      <ErrorNote message={hata} />

      {podium.length > 0 && (
        <Podium
          ids={podium}
          names={names}
          prizes={t.prizes}
          consolationWinner={consolationFinal?.winnerId ? names.get(consolationFinal.winnerId) : undefined}
        />
      )}

      {mainMatches.length > 0 && (
        <section className="card">
          <h2>Eleme tablosu</h2>
          <Bracket columns={columns(mainMatches)} champion={<Champion name={final?.winnerId ? names.get(final.winnerId) : undefined} />} />
          {third && (
            <div className="mt-4 max-w-xs border-t border-zinc-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{ROUND_LABELS["3RD"]}</h3>
              {board(third)}
            </div>
          )}
        </section>
      )}

      {consolationMatches.length > 0 && (
        <section className="card border-sky-200">
          <h2>Teselli turnuvası</h2>
          <p className="-mt-2 mb-3 text-sm text-zinc-500">Gruptan çıkamayan oyuncular kendi aralarında oynuyor.</p>
          <Bracket
            columns={columns(consolationMatches)}
            championLabel="Teselli şampiyonu"
            champion={<Champion consolation name={consolationFinal?.winnerId ? names.get(consolationFinal.winnerId) : undefined} />}
          />
        </section>
      )}

      {t.status === "GROUPS" && (
        <form action={finishGroups} className="card flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={t.id} />
          <div className="min-w-48 flex-1">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium text-zinc-700">Grup maçları</span>
              <span className="tabular-nums text-zinc-500">{done} / {groupMatches.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-court-600 transition-all" style={{ width: `${(done / Math.max(1, groupMatches.length)) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {left > 0
                ? `Grup aşamasını bitirmek için ${left} maç kaldı.`
                : `Tüm grup maçları bitti. Her gruptan ilk 2 oyuncu eleme tablosuna geçer${t.consolation ? ", kalanlar teselli turnuvasında oynar" : ""}.`}
            </p>
          </div>
          <button className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-40" disabled={left > 0}>
            Grup aşamasını bitir
          </button>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {t.groups.map((g) => (
          <section key={g.id} className="card p-0">
            <div className="flex items-center justify-between rounded-t-xl bg-court-800 px-5 py-3 text-white">
              <h2 className="mb-0 text-white">Grup {g.name}</h2>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">Masa {g.table?.number ?? "-"}</span>
            </div>
            <div className="p-5">
              <GroupStandings participants={g.participants} matches={g.matches} qualified={qualified} consoled={consoled} />
              <div className="grid gap-2">{g.matches.map(board)}</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Champion({ name, consolation = false }: { name?: string; consolation?: boolean }) {
  if (!name) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-zinc-200 py-4 text-zinc-400">
        <span className="text-2xl grayscale">🏆</span>
        <span className="text-xs">belli değil</span>
      </div>
    );
  }
  return (
    <div
      className={`flex w-full flex-col items-center gap-1.5 rounded-xl bg-gradient-to-b py-4 text-white shadow-md ${consolation ? "from-sky-500 to-sky-600" : "from-ball-500 to-ball-600"}`}
    >
      <span className="text-3xl">{consolation ? "🎖️" : "🏆"}</span>
      <Avatar name={name} size="lg" />
      <span className="font-display text-lg font-bold">{name}</span>
    </div>
  );
}

function roundOrder(round: string): number {
  return round === "3RD" ? 0 : roundSize(round);
}

type HeroProps = {
  t: { id: string; name: string; status: string; startsAt: Date; endsAt: Date; prizes: { place: number; name: string }[] };
  facts: string[];
};

/** Turnuva başlığı: masa yeşili zemin, ortasında masa çizgisi. */
function Hero({ t, facts }: HeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-court-800 px-6 py-6 text-white shadow-md">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white/10" />
      <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/10" />
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-ball-500/90 shadow-[inset_-10px_-10px_0_rgba(0,0,0,0.12)]" />
      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-3">
          <StatusBadge status={t.status} />
          <a
            href={`/tv/${t.id}`}
            target="_blank"
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
          >
            📺 TV ekranı
          </a>
        </div>
        <h1 className="mb-1 text-white">{t.name}</h1>
        <p className="text-sm text-court-100">
          {t.startsAt.toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "short" })} -{" "}
          {t.endsAt.toLocaleTimeString("tr-TR", { timeStyle: "short" })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {facts.map((f) => (
            <span key={f} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white">{f}</span>
          ))}
          {t.prizes.map((p) => (
            <span key={p.place} className="rounded-full bg-ball-500/90 px-2.5 py-0.5 text-xs font-semibold text-white">
              {p.place}. {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type PodiumProps = {
  ids: (string | null | undefined)[];
  names: Map<string, string>;
  prizes: { place: number; name: string }[];
  consolationWinner?: string;
};

function Podium({ ids, names, prizes, consolationWinner }: PodiumProps) {
  // Görsel sıra: 2 - 1 - 3
  const order = [1, 0, 2];
  const height = ["h-28", "h-20", "h-14"];
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <section className="card">
      <h2>Kazananlar</h2>
      <div className="mx-auto flex max-w-xl items-end justify-center gap-3">
        {order.map((i) => {
          const id = ids[i];
          if (!id) return <div key={i} className="flex-1" />;
          const name = names.get(id) ?? "?";
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span className="text-2xl">{medal[i]}</span>
              <Avatar name={name} size="lg" />
              <span className="font-semibold">{name}</span>
              {prizes.find((p) => p.place === i + 1) && (
                <span className="text-xs text-zinc-500">{prizes.find((p) => p.place === i + 1)!.name}</span>
              )}
              <div className={`mt-1 flex w-full items-start justify-center rounded-t-lg pt-2 font-display text-2xl font-bold text-white ${height[i]} ${i === 0 ? "bg-ball-500" : "bg-court-700"}`}>
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
      {consolationWinner && (
        <p className="mt-4 flex items-center justify-center gap-2 border-t border-zinc-100 pt-3 text-sm">
          <span>🎖️ Teselli şampiyonu:</span>
          <Avatar name={consolationWinner} size="sm" />
          <span className="font-semibold">{consolationWinner}</span>
        </p>
      )}
    </section>
  );
}

type DraftProps = {
  hata?: string;
  t: Prisma.TournamentGetPayload<{
    include: {
      prizes: true;
      blocks: { include: { table: true } };
      participants: { include: { salonPlayer: { include: { player: true } } } };
    };
  }>;
};

/** Turnuva başlamadan önce: katılımcı listesi, ekleme/çıkarma ve başlatma. */
async function DraftTournament({ t, hata }: DraftProps) {
  const inTournament = new Set(t.participants.map((p) => p.salonPlayerId));
  const others = (
    await db.salonPlayer.findMany({ where: { salonId: t.salonId }, include: { player: true }, orderBy: { elo: "desc" } })
  ).filter((p) => !inTournament.has(p.id));
  const tables = [...new Map(t.blocks.map((b) => [b.tableId, b.table.number])).values()];
  const enough = t.participants.length >= MIN_PARTICIPANTS;

  return (
    <div className="space-y-6">
      <Hero
        t={t}
        facts={[`Masa ${tables.join(", ")}`, ...(t.entryFee ? [`katılım ${t.entryFee.toString()} ₺`] : [])]}
      />
      <ErrorNote message={hata} />

      <section className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="mb-0">Katılımcılar ({t.participants.length})</h2>
          <form action={start}>
            <input type="hidden" name="id" value={t.id} />
            <button className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-40" disabled={!enough}>
              Turnuvayı başlat
            </button>
          </form>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          {enough
            ? "Başlattığında gruplar ELO'ya göre dengeli kurulur, maçlar oluşur ve katılımcı listesi kilitlenir."
            : `Başlatmak için en az ${MIN_PARTICIPANTS} katılımcı gerekli.`}
        </p>
        {t.participants.length === 0 ? (
          <p className="text-sm text-zinc-600">Henüz katılımcı yok.</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {t.participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2">
                <Avatar name={p.salonPlayer.player.name} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.salonPlayer.player.name}</span>
                <TierBadge elo={p.salonPlayer.elo} compact />
                <span className="tabular-nums text-zinc-400">{p.salonPlayer.elo}</span>
                <form action={remove}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <button className="text-xs text-zinc-500 hover:text-red-600">Çıkar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={addNew} className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={t.id} />
        <h2 className="w-full">Yeni oyuncu kaydet ve ekle</h2>
        <div><label className="label">Ad soyad</label><input name="name" required className="input" /></div>
        <div><label className="label">E-posta (isteğe bağlı)</label><input name="email" type="email" className="input" /></div>
        <LevelPicker levels={LEVELS} />
        <button className="btn">Ekle</button>
      </form>

      {others.length > 0 && (
        <form action={addExisting} className="card">
          <input type="hidden" name="id" value={t.id} />
          <h2>Salondaki oyunculardan ekle</h2>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {others.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-checked:border-court-600 has-checked:bg-court-50">
                <input type="checkbox" name="players" value={p.id} className="accent-court-700" />
                <Avatar name={p.player.name} size="sm" />
                <span className="flex-1 truncate">{p.player.name}</span>
                <TierBadge elo={p.elo} compact />
                <span className="tabular-nums text-zinc-400">{p.elo}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-ghost">Seçilenleri ekle</button>
        </form>
      )}
    </div>
  );
}

type GroupProps = {
  participants: { salonPlayerId: string; salonPlayer: { elo: number; player: { name: string } } }[];
  matches: {
    playerAId: string | null;
    playerBId: string | null;
    status: string;
    sets: unknown;
    walkover: boolean;
    winnerId: string | null;
    eloHistory: { salonPlayerId: string; delta: number }[];
  }[];
  qualified: Set<string>;
  consoled: Set<string>;
};

/** Grup sıralaması (ITTF): galibiyet 2, mağlubiyet 1 puan; eşitlikte ikili maçlar. */
function GroupStandings({ participants, matches, qualified, consoled }: GroupProps) {
  const finished = matches
    .filter((m) => m.status === "DONE" && m.playerAId && m.playerBId)
    .map((m) => ({ playerAId: m.playerAId!, playerBId: m.playerBId!, sets: m.sets as SetScore[] | null, walkoverWinnerId: m.walkover ? m.winnerId : null }));
  const byId = new Map(participants.map((p) => [p.salonPlayerId, p.salonPlayer]));
  const rows = groupStandings(participants.map((p) => p.salonPlayerId), finished);
  // Bu gruptaki maçlardan gelen toplam ELO değişimi
  const delta = new Map<string, number>();
  for (const h of matches.flatMap((m) => m.eloHistory)) delta.set(h.salonPlayerId, (delta.get(h.salonPlayerId) ?? 0) + h.delta);
  const th = "px-1.5 py-1.5 text-right font-medium";
  return (
    <table className="mb-4 w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs text-zinc-500">
          <th className="w-7 py-1.5 text-left font-medium">#</th>
          <th className="py-1.5 text-left font-medium">Oyuncu</th>
          <th className={th}>O</th>
          <th className={th}>G-M</th>
          <th className={`${th} hidden sm:table-cell`}>Set</th>
          <th className={th}>P</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const sp = byId.get(r.playerId)!;
          const up = qualified.has(r.playerId);
          return (
            <tr key={r.playerId} className={`border-b border-zinc-100 last:border-0 ${up ? "bg-court-50" : ""}`}>
              <td className="py-2 pl-1">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${up ? "bg-court-700 text-white" : "text-zinc-400"}`}>
                  {i + 1}
                </span>
              </td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <Avatar name={sp.player.name} size="sm" />
                  <span className="truncate font-medium">{sp.player.name}</span>
                  <TierBadge elo={sp.elo} compact />
                  <span className="text-xs tabular-nums text-zinc-400">{sp.elo}</span>
                  <EloDelta delta={delta.get(r.playerId)} />
                  {up && <span className="rounded-full bg-court-700 px-1.5 text-[10px] font-semibold tracking-wide text-white uppercase">↑ Eleme</span>}
                  {consoled.has(r.playerId) && (
                    <span className="rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold tracking-wide text-sky-800 uppercase">Teselli</span>
                  )}
                </span>
              </td>
              <td className="px-1.5 text-right tabular-nums text-zinc-600">{r.played}</td>
              <td className="px-1.5 text-right tabular-nums text-zinc-600">{r.wins}-{r.losses}</td>
              <td className="hidden px-1.5 text-right tabular-nums text-zinc-600 sm:table-cell">{r.setsFor}-{r.setsAgainst}</td>
              <td className="px-1.5 text-right font-display text-base font-bold tabular-nums">{r.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
