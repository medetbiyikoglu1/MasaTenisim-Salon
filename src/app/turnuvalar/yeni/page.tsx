import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { nextFriday } from "@/lib/rental";
import { currentSalon } from "@/lib/salon";
import { ErrorNote } from "@/components/ErrorNote";
import { TournamentError, createTournament } from "@/lib/services/tournament";

export const dynamic = "force-dynamic";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  const salon = await currentSalon();
  const date = String(formData.get("date"));
  const fee = String(formData.get("entryFee") ?? "").trim();
  let id: string;
  try {
    const t = await createTournament({
      salonId: salon.id,
      name: String(formData.get("name")).trim() || "Cuma Turnuvası",
      startsAt: new Date(`${date}T${formData.get("start")}:00`),
      endsAt: new Date(`${date}T${formData.get("end")}:00`),
      entryFee: fee ? Number(fee) : null,
      prizes: [1, 2, 3].map((i) => String(formData.get(`prize${i}`) ?? "")),
      tableIds: formData.getAll("tables").map(String),
      consolation: formData.get("consolation") === "on",
    });
    id = t.id;
  } catch (e) {
    if (e instanceof TournamentError) redirect(`/turnuvalar/yeni?hata=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/turnuvalar/${id}`);
}

export default async function NewTournamentPage({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  const { hata } = await searchParams;
  const salon = await currentSalon();
  const tables = await db.table.findMany({ where: { salonId: salon.id, active: true }, orderBy: { number: "asc" } });
  return (
    <form action={create} className="space-y-6">
      <h1>Yeni turnuva</h1>
      <ErrorNote message={hata} />
      <section className="card grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className="label">Ad</label><input name="name" defaultValue="Cuma Turnuvası" className="input w-full" /></div>
        <div><label className="label">Tarih</label><input name="date" type="date" defaultValue={nextFriday()} required className="input w-full" /></div>
        <div><label className="label">Katılım ücreti (₺, bilgi)</label><input name="entryFee" type="number" min={0} className="input w-full" /></div>
        <div><label className="label">Başlangıç</label><input name="start" type="time" step={1800} defaultValue="20:00" required className="input w-full" /></div>
        <div><label className="label">Bitiş</label><input name="end" type="time" step={1800} defaultValue="23:00" required className="input w-full" /></div>
        {[1, 2, 3].map((i) => (
          <div key={i}><label className="label">{i}. ödülü</label><input name={`prize${i}`} placeholder="ör. madalya" className="input w-full" /></div>
        ))}
      </section>
      <section className="card">
        <h2>Masalar</h2>
        <div className="flex flex-wrap gap-3">
          {tables.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tables" value={t.id} defaultChecked className="accent-court-700" /> Masa {t.number}
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Format</h2>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 has-checked:border-court-600 has-checked:bg-court-50">
          <input type="checkbox" name="consolation" className="mt-1 accent-court-700" />
          <span>
            <span className="block font-medium">Teselli turnuvası olsun</span>
            <span className="block text-sm text-zinc-600">
              Her gruptan ilk 2 oyuncu normal eleme tablosuna geçer; gruptan çıkamayanlar kendi aralarında ayrı bir teselli
              eleme tablosunda oynar. Böylece grupta elenenler de daha fazla maç yapar.
            </span>
          </span>
        </label>
      </section>
      <p className="text-sm text-zinc-600">Katılımcıları turnuvayı oluşturduktan sonra, turnuva başlayana kadar ekleyebilirsin.</p>
      <button className="btn btn-accent">Turnuvayı oluştur</button>
    </form>
  );
}
