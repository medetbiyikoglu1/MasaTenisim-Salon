import { db } from "../db";
import {
  SLOT_MINUTES,
  atMinutes,
  daySlots,
  fromMinutes,
  occupancyPercent,
  overlaps,
  rentalPrice,
  validateRentalTime,
  ymd,
  type HourlyRates,
} from "../rental";

/** Kullanıcıya olduğu gibi gösterilebilecek doğrulama hatası. */
export class RentalError extends Error {}

const timeOf = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export async function hourlyRates(salonId: string): Promise<HourlyRates> {
  const rules = await db.priceRule.findMany({ where: { salonId } });
  return Object.fromEntries(rules.map((r) => [r.dayType, Number(r.hourlyRate)]));
}

export async function createRental(input: { tableId: string; startsAt: Date; endsAt: Date; customerName: string }) {
  const customerName = input.customerName.trim();
  if (!customerName) throw new RentalError("Müşteri adı girilmeli");
  const table = await db.table.findUnique({ where: { id: input.tableId }, include: { salon: true } });
  if (!table) throw new RentalError("Masa bulunamadı");
  if (!table.active) throw new RentalError(`Masa ${table.number} kapalı; önce aktif yap`);
  try {
    validateRentalTime(input.startsAt, input.endsAt, table.salon);
  } catch (e) {
    throw new RentalError((e as Error).message);
  }

  const range = { startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } };
  const [rental, block] = await Promise.all([
    db.rental.findFirst({ where: { tableId: table.id, ...range } }),
    db.tableBlock.findFirst({ where: { tableId: table.id, ...range }, include: { tournament: true } }),
  ]);
  if (rental) {
    throw new RentalError(`Bu saatlerde ${rental.customerName} kiralaması var (${timeOf(rental.startsAt)}-${timeOf(rental.endsAt)})`);
  }
  if (block) {
    throw new RentalError(`Masa bu saatlerde "${block.tournament.name}" turnuvasına ayrılmış (${timeOf(block.startsAt)}-${timeOf(block.endsAt)})`);
  }

  const amount = rentalPrice(input.startsAt, input.endsAt, await hourlyRates(table.salonId)) ?? 0;
  return db.rental.create({
    data: { tableId: table.id, startsAt: input.startsAt, endsAt: input.endsAt, customerName, amount },
  });
}

export async function cancelRental(rentalId: string) {
  await db.rental.deleteMany({ where: { id: rentalId } });
}

/** Turnuvaya seçilen masalarda o saatlerde kiralama varsa açıklayıcı liste döner. */
export async function rentalConflicts(tableIds: string[], startsAt: Date, endsAt: Date): Promise<string[]> {
  const rentals = await db.rental.findMany({
    where: { tableId: { in: tableIds }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    include: { table: true },
    orderBy: [{ table: { number: "asc" } }, { startsAt: "asc" }],
  });
  return rentals.map((r) => `Masa ${r.table.number}: ${r.customerName} ${timeOf(r.startsAt)}-${timeOf(r.endsAt)}`);
}

export type Slot =
  | { time: string; kind: "free" | "past" }
  | { time: string; kind: "rental"; rentalId: string; label: string; first: boolean; range: string; amount: string }
  | { time: string; kind: "block"; label: string; first: boolean };

export type CalendarDay = { date: string; slots: Slot[] };

/** Bir masanın haftalık takvimi: her gün için 30 dakikalık dilimlerin durumu ve doluluk oranı. */
export async function weekCalendar(tableId: string, monday: Date, now: Date = new Date()) {
  const table = await db.table.findUniqueOrThrow({ where: { id: tableId }, include: { salon: true } });
  const { openTime, closeTime } = table.salon;
  const weekEnd = new Date(monday);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const range = { startsAt: { lt: weekEnd }, endsAt: { gt: monday } };
  const [rentals, blocks] = await Promise.all([
    db.rental.findMany({ where: { tableId, ...range } }),
    db.tableBlock.findMany({ where: { tableId, ...range }, include: { tournament: true } }),
  ]);

  let busy = 0;
  let open = 0;
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    const slots = daySlots(openTime, closeTime).map((min): Slot => {
      const slot = { startsAt: atMinutes(day, min), endsAt: atMinutes(day, min + SLOT_MINUTES) };
      const time = fromMinutes(min);
      open++;
      const r = rentals.find((x) => overlaps(x, slot));
      if (r) {
        busy++;
        return {
          time,
          kind: "rental",
          rentalId: r.id,
          label: r.customerName,
          first: r.startsAt >= slot.startsAt,
          range: `${timeOf(r.startsAt)}-${timeOf(r.endsAt)}`,
          amount: r.amount.toString(),
        };
      }
      const b = blocks.find((x) => overlaps(x, slot));
      if (b) {
        busy++;
        return { time, kind: "block", label: b.tournament.name, first: b.startsAt >= slot.startsAt };
      }
      return { time, kind: slot.startsAt < now ? "past" : "free" };
    });
    days.push({ date: ymd(day), slots });
  }
  return { table, days, occupancy: occupancyPercent(busy, open) };
}
