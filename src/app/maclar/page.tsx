import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import { Scoreboard } from "@/components/ui";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";
import { INDIVIDUAL_BEST_OF, MatchError, deleteIndividualMatch, saveIndividualMatch } from "@/lib/services/match";
import type { SetScore } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type FormValues = { a: string; b: string; tarih: string; masa: string; skor: string };

/** Yerel saatle "YYYY-MM-DDTHH:mm" (datetime-local alanı için). */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const salon = await currentSalon();
  const matchId = String(formData.get("matchId") ?? "") || undefined;
  const values: FormValues = {
    a: String(formData.get("a") ?? ""),
    b: String(formData.get("b") ?? ""),
    tarih: String(formData.get("tarih") ?? ""),
    masa: String(formData.get("masa") ?? ""),
    skor: "",
  };
  const rows: [string, string][] = [];
  for (let i = 0; formData.has(`a${i}`); i++) rows.push([String(formData.get(`a${i}`)).trim(), String(formData.get(`b${i}`)).trim()]);
  values.skor = rows.map((r) => r.join("-")).join(",");
  try {
    const sets: SetScore[] = [];
    for (const [i, [x, y]] of rows.entries()) {
      if (!x && !y) continue;
      if (!x || !y) throw new MatchError(`${i + 1}. setin iki skoru da girilmeli`);
      sets.push([Number(x), Number(y)]);
    }
    await saveIndividualMatch(
      { salonId: salon.id, playerAId: values.a, playerBId: values.b, sets, playedAt: new Date(values.tarih), tableId: values.masa || null },
      matchId,
    );
  } catch (e) {
    if (e instanceof MatchError) {
      const q = new URLSearchParams({ hata: e.message, ...values, ...(matchId ? { duzenle: matchId } : {}) });
      redirect(`/maclar?${q}`);
    }
    throw e;
  }
  revalidatePath("/maclar");
  redirect(`/maclar?tamam=${encodeURIComponent(matchId ? "Maç düzeltildi, ELO yeniden hesaplandı" : "Maç kaydedildi, ELO güncellendi")}`);
}

async function remove(formData: FormData) {
  "use server";
  await requireAdmin();
  const salon = await currentSalon();
  try {
    await deleteIndividualMatch(salon.id, String(formData.get("matchId")));
  } catch (e) {
    if (e instanceof MatchError) redirect(`/maclar?hata=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/maclar");
  redirect(`/maclar?tamam=${encodeURIComponent("Maç silindi, ELO etkisi geri alındı")}`);
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Partial<FormValues> & { hata?: string; tamam?: string; duzenle?: string }>;
}) {
  const q = await searchParams;
  const salon = await currentSalon();
  const [players, tables, matches] = await Promise.all([
    db.salonPlayer.findMany({ where: { salonId: salon.id }, include: { player: true }, orderBy: { player: { name: "asc" } } }),
    db.table.findMany({ where: { salonId: salon.id }, orderBy: { number: "asc" } }),
    db.match.findMany({
      where: { salonId: salon.id, tournamentId: null },
      include: { eloHistory: true, table: true },
      orderBy: { finishedAt: "desc" },
      take: 30,
    }),
  ]);
  const names = new Map(players.map((p) => [p.id, p.player.name]));

  // Düzenleme: önce hatalı gönderimden dönen değerler, yoksa kayıtlı maç
  const editing = q.duzenle ? matches.find((m) => m.id === q.duzenle) ?? (await db.match.findUnique({ where: { id: q.duzenle } })) : null;
  const defaults: FormValues = {
    a: q.a ?? editing?.playerAId ?? "",
    b: q.b ?? editing?.playerBId ?? "",
    tarih: q.tarih ?? localInput(editing?.finishedAt ?? new Date()),
    masa: q.masa ?? editing?.tableId ?? "",
    skor: q.skor ?? ((editing?.sets as SetScore[] | null) ?? []).map((s) => s.join("-")).join(","),
  };
  const sets = defaults.skor ? defaults.skor.split(",").map((r) => r.split("-")) : [];
  const playerOptions = players.map((p) => (
    <option key={p.id} value={p.id}>
      {p.player.name} ({p.elo})
    </option>
  ));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1">Bireysel maçlar</h1>
        <p className="text-sm text-zinc-600">İki oyuncu turnuva dışında kendi arasında oynadığında sonucu buradan gir; ELO güncellenir.</p>
      </div>

      <ErrorNote message={q.hata} />
      {q.tamam && <p className="rounded-md border border-court-600/30 bg-court-50 px-3 py-2 text-sm text-court-800">{q.tamam}</p>}

      <form key={`${editing?.id ?? "yeni"}-${q.hata ?? ""}-${q.tamam ?? ""}`} action={save} className={`card space-y-4 ${editing ? "ring-2 ring-ball-500" : ""}`}>
        {editing && <input type="hidden" name="matchId" value={editing.id} />}
        <div className="flex items-center justify-between">
          <h2 className="mb-0">{editing ? "Maçı düzelt" : "Maç gir"}</h2>
          {editing && <Link href="/maclar" className="text-sm text-zinc-500 hover:text-zinc-900">Vazgeç</Link>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">1. oyuncu</label>
            <select name="a" required defaultValue={defaults.a} className="input w-full">
              <option value="">Seç</option>
              {playerOptions}
            </select>
          </div>
          <div>
            <label className="label">2. oyuncu</label>
            <select name="b" required defaultValue={defaults.b} className="input w-full">
              <option value="">Seç</option>
              {playerOptions}
            </select>
          </div>
          <div>
            <label className="label">Tarih ve saat</label>
            <input name="tarih" type="datetime-local" required defaultValue={defaults.tarih} className="input w-full" />
          </div>
          <div>
            <label className="label">Masa (isteğe bağlı)</label>
            <select name="masa" defaultValue={defaults.masa} className="input w-full">
              <option value="">-</option>
              {tables.map((t) => <option key={t.id} value={t.id}>Masa {t.number}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Set skorları (1. oyuncu - 2. oyuncu)</label>
          <div className="grid grid-cols-5 gap-2 sm:max-w-xl">
            {Array.from({ length: INDIVIDUAL_BEST_OF }, (_, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 p-1.5 text-center">
                <div className="mb-1 text-[11px] text-zinc-500">{i + 1}. set</div>
                <input name={`a${i}`} type="number" min={0} inputMode="numeric" defaultValue={sets[i]?.[0]} aria-label={`${i + 1}. set 1. oyuncu`} className="input mb-1 w-full px-1 text-center" />
                <input name={`b${i}`} type="number" min={0} inputMode="numeric" defaultValue={sets[i]?.[1]} aria-label={`${i + 1}. set 2. oyuncu`} className="input w-full px-1 text-center" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Best of {INDIVIDUAL_BEST_OF}: 3 seti alan kazanır. Oynanmayan setleri boş bırak. Set 11 sayıda biter, 10-10 olursa 2 fark gerekir.</p>
        </div>
        <button className="btn btn-accent">{editing ? "Düzeltmeyi kaydet" : "Maçı kaydet"}</button>
      </form>

      <section className="card">
        <h2>Son bireysel maçlar</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-zinc-600">Henüz bireysel maç girilmedi.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {matches.map((m) => {
              const side = (pid: string | null) =>
                pid ? { id: pid, name: names.get(pid) ?? "?", delta: m.eloHistory.find((h) => h.salonPlayerId === pid)?.delta } : null;
              return (
                <li key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>
                      {m.finishedAt?.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                      {m.table && ` · Masa ${m.table.number}`}
                    </span>
                    <span className="flex gap-3">
                      <Link href={`/maclar?duzenle=${m.id}`} className="font-medium text-court-700 hover:underline">Düzelt</Link>
                      <form action={remove}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <button className="font-medium text-red-600 hover:underline">Sil</button>
                      </form>
                    </span>
                  </div>
                  <Scoreboard
                    a={side(m.playerAId)}
                    b={side(m.playerBId)}
                    sets={m.sets as SetScore[] | null}
                    winnerId={m.winnerId}
                    done={m.status === "DONE"}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
