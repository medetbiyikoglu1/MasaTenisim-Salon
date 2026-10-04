import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";
import { createTournament } from "@/lib/services/tournament";

export const dynamic = "force-dynamic";

/** Bir sonraki cuma (bugün cumaysa bugün), YYYY-MM-DD */
function nextFriday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

async function create(formData: FormData) {
  "use server";
  const salon = await currentSalon();
  const date = String(formData.get("date"));
  const fee = String(formData.get("entryFee") ?? "").trim();
  const t = await createTournament({
    salonId: salon.id,
    name: String(formData.get("name")).trim() || "Cuma Turnuvası",
    startsAt: new Date(`${date}T${formData.get("start")}:00`),
    endsAt: new Date(`${date}T${formData.get("end")}:00`),
    entryFee: fee ? Number(fee) : null,
    prizes: [1, 2, 3].map((i) => String(formData.get(`prize${i}`) ?? "")),
    salonPlayerIds: formData.getAll("players").map(String),
    tableIds: formData.getAll("tables").map(String),
  });
  redirect(`/turnuvalar/${t.id}`);
}

export default async function NewTournamentPage() {
  const salon = await currentSalon();
  const [players, tables] = await Promise.all([
    db.salonPlayer.findMany({ where: { salonId: salon.id }, include: { player: true }, orderBy: { elo: "desc" } }),
    db.table.findMany({ where: { salonId: salon.id, active: true }, orderBy: { number: "asc" } }),
  ]);
  return (
    <form action={create} className="space-y-6">
      <h1>Yeni turnuva</h1>
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
              <input type="checkbox" name="tables" value={t.id} defaultChecked /> Masa {t.number}
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Katılımcılar</h2>
        <p className="mb-3 text-xs text-zinc-500">{"Gruplar ELO'ya göre otomatik ve dengeli kurulur (16 kişi 4×4, 20 kişi 5×4)."}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {players.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="players" value={p.id} /> {p.player.name} <span className="text-zinc-400">{p.elo}</span>
            </label>
          ))}
        </div>
      </section>
      <button className="btn">Turnuvayı oluştur</button>
    </form>
  );
}
