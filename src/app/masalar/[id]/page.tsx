import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import { RentalCalendar } from "@/components/RentalCalendar";
import { db } from "@/lib/db";
import { parseYmd, weekStart, ymd } from "@/lib/rental";
import { RentalError, cancelRental, createRental, hourlyRates, weekCalendar } from "@/lib/services/rental";

export const dynamic = "force-dynamic";

const back = (tableId: string, week: string, extra: Record<string, string> = {}) =>
  `/masalar/${tableId}?${new URLSearchParams({ hafta: week, ...extra })}`;

async function rent(formData: FormData) {
  "use server";
  await requireAdmin();
  const tableId = String(formData.get("tableId"));
  const week = String(formData.get("week"));
  const date = String(formData.get("date"));
  const at = (hhmm: string) => {
    const d = parseYmd(date);
    const [h, m] = hhmm.split(":").map(Number);
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) : new Date(NaN);
  };
  try {
    await createRental({
      tableId,
      startsAt: at(String(formData.get("start"))),
      endsAt: at(String(formData.get("end"))),
      customerName: String(formData.get("customerName") ?? ""),
    });
  } catch (e) {
    if (e instanceof RentalError) redirect(back(tableId, week, { hata: e.message }));
    throw e;
  }
  revalidatePath("/masalar");
  redirect(back(tableId, week, { tamam: "Kiralama kaydedildi" }));
}

async function cancel(formData: FormData) {
  "use server";
  await requireAdmin();
  const tableId = String(formData.get("tableId"));
  const week = String(formData.get("week"));
  await cancelRental(String(formData.get("rentalId")));
  revalidatePath("/masalar");
  redirect(back(tableId, week, { tamam: "Kiralama iptal edildi" }));
}

export default async function TableCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hafta?: string; hata?: string; tamam?: string }>;
}) {
  const { id } = await params;
  const { hafta, hata, tamam } = await searchParams;
  const exists = await db.table.findUnique({ where: { id } });
  if (!exists) notFound();

  const monday = weekStart(parseYmd(hafta) ?? new Date());
  const { table, days, occupancy } = await weekCalendar(id, monday);
  const rates = await hourlyRates(table.salonId);
  const shift = (n: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + n * 7);
    return ymd(d);
  };
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("tr-TR", opts);
  const thisWeek = ymd(weekStart(new Date()));

  return (
    <div className="space-y-5">
      <Link href="/masalar" className="text-sm text-zinc-500 hover:text-zinc-900">← Masalar</Link>

      <div className="relative overflow-hidden rounded-2xl bg-court-800 px-6 py-5 text-white shadow-md">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white/10" />
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/10" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex-1">
            <h1 className="mb-0 text-white">Masa {table.number}</h1>
            <p className="text-sm text-court-100">
              {table.salon.openTime}-{table.salon.closeTime} açık · hafta içi {rates.WEEKDAY ?? "-"} ₺/saat · hafta sonu {rates.WEEKEND ?? "-"} ₺/saat
              {!table.active && <span className="ml-2 rounded bg-red-500 px-1.5 text-xs font-semibold">kapalı</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-bold tabular-nums">%{occupancy}</div>
            <div className="text-xs tracking-wider text-court-100 uppercase">bu hafta doluluk</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={back(id, shift(-1))} className="btn btn-ghost px-3" aria-label="Önceki hafta">‹</Link>
          <Link href={back(id, shift(1))} className="btn btn-ghost px-3" aria-label="Sonraki hafta">›</Link>
          {ymd(monday) !== thisWeek && <Link href={back(id, thisWeek)} className="btn btn-ghost">Bu hafta</Link>}
        </div>
        <h2 className="mb-0">
          {fmt(monday, { day: "numeric", month: "long" })} - {fmt(sunday, { day: "numeric", month: "long", year: "numeric" })}
        </h2>
      </div>

      <ErrorNote message={hata} />
      {tamam && <p className="rounded-md border border-court-600/30 bg-court-50 px-3 py-2 text-sm text-court-800">{tamam}</p>}

      <RentalCalendar
        key={ymd(monday)}
        tableId={id}
        week={ymd(monday)}
        days={days}
        rates={rates}
        today={ymd(new Date())}
        create={rent}
        cancel={cancel}
      />
    </div>
  );
}
