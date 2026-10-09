import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";
import { weekStart } from "@/lib/rental";
import { weekCalendar } from "@/lib/services/rental";

export const dynamic = "force-dynamic";

async function addTable() {
  "use server";
  await requireAdmin();
  const salon = await currentSalon();
  const last = await db.table.findFirst({ where: { salonId: salon.id }, orderBy: { number: "desc" } });
  await db.table.create({ data: { salonId: salon.id, number: (last?.number ?? 0) + 1 } });
  revalidatePath("/masalar");
}

async function toggleTable(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const table = await db.table.findUniqueOrThrow({ where: { id } });
  await db.table.update({ where: { id }, data: { active: !table.active } });
  revalidatePath("/masalar");
}

async function savePrices(formData: FormData) {
  "use server";
  await requireAdmin();
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
  const monday = weekStart(new Date());
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const stats = await Promise.all(
    tables.map(async (t) => ({
      occupancy: (await weekCalendar(t.id, monday)).occupancy,
      today: await db.rental.count({ where: { tableId: t.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } }),
    })),
  );
  return (
    <div className="space-y-6">
      <h1>Masalar ve ücretler</h1>
      <section className="space-y-3">
        <p className="text-sm text-zinc-600">Kiralamak için masaya tıkla; haftalık takvim açılır.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t, i) => (
            <div
              key={t.id}
              className={`relative overflow-hidden rounded-xl border shadow-sm transition ${t.active ? "border-zinc-200/80 bg-white hover:border-court-600 hover:shadow-md" : "border-zinc-200 bg-zinc-100"}`}
            >
              <Link href={`/masalar/${t.id}`} className="block p-5">
                {/* Masa çizimi */}
                <div className={`relative mb-4 h-20 rounded-lg ${t.active ? "bg-court-800" : "bg-zinc-400"}`}>
                  <div className="absolute inset-1.5 rounded border-2 border-white/60" />
                  <div className="absolute inset-y-1.5 left-1/2 w-0.5 -translate-x-1/2 bg-white/60" />
                  <div className="absolute inset-x-1.5 top-1/2 h-px bg-white/40" />
                  <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold text-white drop-shadow">
                    {t.number}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-display text-xl font-semibold">Masa {t.number}</div>
                    <div className="text-xs text-zinc-500">
                      {t.active ? `Bugün ${stats[i].today} kiralama` : "Kapalı"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold tabular-nums text-court-700">%{stats[i].occupancy}</div>
                    <div className="text-[10px] tracking-wider text-zinc-500 uppercase">haftalık doluluk</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-ball-500" style={{ width: `${stats[i].occupancy}%` }} />
                </div>
              </Link>
              <form action={toggleTable} className="absolute top-2 right-2">
                <input type="hidden" name="id" value={t.id} />
                <button
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.active ? "bg-white/90 text-zinc-600 hover:bg-white" : "bg-court-700 text-white"}`}
                  title={t.active ? "Masayı kapat" : "Masayı aç"}
                >
                  {t.active ? "Aktif ✓" : "Aç"}
                </button>
              </form>
            </div>
          ))}
          <form action={addTable}>
            <button className="flex h-full min-h-40 w-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-sm font-medium text-zinc-500 transition hover:border-court-600 hover:text-court-700">
              + Masa ekle
            </button>
          </form>
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
