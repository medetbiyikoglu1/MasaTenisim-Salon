import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ErrorNote } from "@/components/ErrorNote";
import { Avatar, EloDelta } from "@/components/ui";
import { db } from "@/lib/db";
import { TournamentError, recordMatchResult, recordWalkover } from "@/lib/services/tournament";
import { knockoutLabel, type SetScore } from "@/lib/tournament";

export const dynamic = "force-dynamic";


async function save(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const matchId = String(formData.get("matchId"));
  const rows: [string, string][] = [];
  for (let i = 0; formData.has(`a${i}`); i++) {
    rows.push([String(formData.get(`a${i}`)).trim(), String(formData.get(`b${i}`)).trim()]);
  }
  try {
    const sets: SetScore[] = [];
    for (const [i, [a, b]] of rows.entries()) {
      if (!a && !b) continue;
      if (!a || !b) throw new TournamentError(`${i + 1}. setin iki skoru da girilmeli`);
      sets.push([Number(a), Number(b)]);
    }
    await recordMatchResult(matchId, sets);
  } catch (e) {
    if (e instanceof TournamentError) {
      // Girilen skorlar formda kalsın
      const q = new URLSearchParams({ hata: e.message, skor: rows.map((r) => r.join("-")).join(",") });
      redirect(`/turnuvalar/${id}/mac/${matchId}?${q}`);
    }
    throw e;
  }
  revalidatePath(`/turnuvalar/${id}`);
  redirect(`/turnuvalar/${id}`);
}

async function walkover(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const matchId = String(formData.get("matchId"));
  try {
    await recordWalkover(matchId, String(formData.get("winnerId")));
  } catch (e) {
    if (e instanceof TournamentError) redirect(`/turnuvalar/${id}/mac/${matchId}?${new URLSearchParams({ hata: e.message })}`);
    throw e;
  }
  revalidatePath(`/turnuvalar/${id}`);
  redirect(`/turnuvalar/${id}`);
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; matchId: string }>;
  searchParams: Promise<{ hata?: string; skor?: string }>;
}) {
  const { id, matchId } = await params;
  const { hata, skor } = await searchParams;
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true, group: { include: { table: true } }, eloHistory: true },
  });
  if (!match || !match.tournament || match.tournamentId !== id || !match.playerAId || !match.playerBId) notFound();
  const players = await db.salonPlayer.findMany({
    where: { id: { in: [match.playerAId, match.playerBId] } },
    include: { player: true },
  });
  const nameOf = (spId: string) => players.find((p) => p.id === spId)?.player.name ?? "?";
  const [nameA, nameB] = [nameOf(match.playerAId), nameOf(match.playerBId)];
  // Hatalı gönderimden dönüldüyse girilen değerler, yoksa kayıtlı skor
  const sets: (string | number)[][] = skor ? skor.split(",").map((r) => r.split("-")) : ((match.sets as SetScore[] | null) ?? []);
  const deltaOf = (spId: string) => match.eloHistory.find((h) => h.salonPlayerId === spId)?.delta;

  return (
    <div className="max-w-xl space-y-4">
      <Link href={`/turnuvalar/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900">← {match.tournament.name}</Link>
      <div className="overflow-hidden rounded-2xl bg-court-800 p-5 text-white shadow-md">
        <p className="mb-3 text-center text-xs font-medium tracking-wider text-court-100 uppercase">
          {match.group ? `Grup ${match.group.name} · Masa ${match.group.table?.number ?? "-"}` : knockoutLabel(match.round, match.bracket)} · best of{" "}
          {match.tournament.bestOf}
        </p>
        <div className="flex items-center justify-between gap-3">
          {[match.playerAId, match.playerBId].map((pid, i) => (
            <div key={pid} className={`flex flex-1 flex-col items-center gap-1.5 text-center ${i === 1 ? "order-3" : ""}`}>
              <Avatar name={nameOf(pid)} size="lg" />
              <span className={`font-display text-xl font-semibold ${match.winnerId === pid ? "text-ball-500" : ""}`}>{nameOf(pid)}</span>
              {match.status === "DONE" && <EloDelta delta={deltaOf(pid)} />}
            </div>
          ))}
          <span className="order-2 font-display text-3xl font-bold text-white/60">VS</span>
        </div>
      </div>
      {match.status === "DONE" && <p className="text-sm text-zinc-500">Sonuç girildi; değiştirip kaydedersen ELO yeniden hesaplanır.</p>}
      <ErrorNote message={hata} />
      <form action={save} className="card space-y-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="matchId" value={matchId} />
        <div className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
          <span />
          <span className="truncate font-medium">{nameA}</span>
          <span className="truncate font-medium">{nameB}</span>
          {Array.from({ length: match.tournament.bestOf }, (_, i) => (
            <SetRow key={i} i={i} set={sets[i]} />
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Oynanmayan setleri boş bırak. Set 11 sayıda biter, 10-10 olursa 2 fark gerekir. Kaydedince ELO güncellenir.
        </p>
        <button className="btn btn-accent w-full sm:w-auto">Sonucu kaydet</button>
      </form>

      <section className="card space-y-3">
        <div>
          <h2 className="mb-1">Hükmen</h2>
          <p className="text-xs text-zinc-500">
            Oyunculardan biri maça gelmediyse diğeri hükmen kazanır. Set girilmez, ELO ve maç sayısı değişmez; grup
            sıralamasında kazanan 2, gelmeyen 0 puan alır.
          </p>
        </div>
        {match.walkover && (
          <p className="rounded-md bg-court-50 px-3 py-2 text-sm text-court-800">
            Bu maç hükmen sonuçlandı: {nameOf(match.winnerId ?? "")} kazandı. Değiştirmek için yukarıdan skor gir ya da diğer oyuncuyu seç.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {/* Her oyuncu için ayrı form: kazanan gizli alanla gider (buton değeri bazı tarayıcılarda gönderilmiyor) */}
          {[match.playerAId, match.playerBId].map((pid) => (
            <form key={pid} action={walkover}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="winnerId" value={pid} />
              <button
                disabled={match.walkover && match.winnerId === pid}
                className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nameOf(pid)} hükmen kazandı
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

function SetRow({ i, set }: { i: number; set?: (string | number)[] }) {
  return (
    <>
      <span className="text-zinc-500">{i + 1}. set</span>
      <input name={`a${i}`} type="number" min={0} inputMode="numeric" defaultValue={set?.[0]} className="input w-full" />
      <input name={`b${i}`} type="number" min={0} inputMode="numeric" defaultValue={set?.[1]} className="input w-full" />
    </>
  );
}

