import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";

export const dynamic = "force-dynamic";

async function addTable() {
  "use server";
  const salon = await currentSalon();
  const last = await db.table.findFirst({ where: { salonId: salon.id }, orderBy: { number: "desc" } });
  await db.table.create({ data: { salonId: salon.id, number: (last?.number ?? 0) + 1 } });
  revalidatePath("/masalar");
}

async function toggleTable(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const table = await db.table.findUniqueOrThrow({ where: { id } });
  await db.table.update({ where: { id }, data: { active: !table.active } });
  revalidatePath("/masalar");
}

async function savePrices(formData: FormData) {
  "use server";
  const salon = await currentSalon();
  for (const dayType of ["WEEKDAY", "WEEKEND"] as const) {
    const rate = Number(formData.get(dayType));
    if (!Number.isFinite(rate) || rate < 0) continue;
    await db.priceRule.upsert({
      where: { salonId_dayType: { salonId: salon.id, dayType } },
      update: { hourlyRate: rate },
      create: { salonId: salon.id, dayType, hourlyRate: rate },
    });
  }
  revalidatePath("/masalar");
}

export default async function TablesPage() {
  const salon = await currentSalon();
  const [tables, prices] = await Promise.all([
    db.table.findMany({ where: { salonId: salon.id }, orderBy: { number: "asc" } }),
    db.priceRule.findMany({ where: { salonId: salon.id } }),
  ]);
  const rate = (d: string) => prices.find((p) => p.dayType === d)?.hourlyRate.toString() ?? "";
  return (
    <div className="space-y-6">
      <h1>Masalar ve ücretler</h1>
      <section className="card">
        <h2>Masalar</h2>
        <div className="flex flex-wrap gap-3">
          {tables.map((t) => (
            <form key={t.id} action={toggleTable}>
              <input type="hidden" name="id" value={t.id} />
              <button className={`rounded-xl border px-5 py-4 text-sm shadow-sm transition ${t.active ? "border-court-600 bg-court-50 text-court-800 font-medium" : "bg-zinc-100 text-zinc-400"}`}>
                Masa {t.number}<br /><span className="text-xs">{t.active ? "aktif" : "kapalı"}</span>
              </button>
            </form>
          ))}
          <form action={addTable}><button className="rounded-xl border-2 border-dashed border-zinc-300 px-5 py-4 text-sm text-zinc-500 hover:border-court-600 hover:text-court-700">+ Masa ekle</button></form>
        </div>
      </section>
      <form action={savePrices} className="card flex flex-wrap items-end gap-3">
        <h2 className="w-full">Saatlik kiralama ücreti (₺)</h2>
        <div><label className="label">Hafta içi</label><input name="WEEKDAY" type="number" min={0} step="0.01" defaultValue={rate("WEEKDAY")} className="input" /></div>
        <div><label className="label">Hafta sonu</label><input name="WEEKEND" type="number" min={0} step="0.01" defaultValue={rate("WEEKEND")} className="input" /></div>
        <button className="btn">Kaydet</button>
        <p className="w-full text-xs text-zinc-500">30 dakikalık kiralama saatlik ücretin yarısıdır. Ödeme uygulama dışında alınır.</p>
      </form>
    </div>
  );
}
