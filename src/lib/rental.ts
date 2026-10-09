/** Masa kiralama kuralları. Veritabanından bağımsızdır. */

export const SLOT_MINUTES = 30;

export type DayType = "WEEKDAY" | "WEEKEND";
export type HourlyRates = Partial<Record<DayType, number>>;

/** "HH:mm" -> gece yarısından itibaren dakika ("24:00" = 1440). */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Çalışma saatleri içindeki 30 dakikalık dilimlerin başlangıçları (dakika). */
export function daySlots(openTime: string, closeTime: string): number[] {
  const out: number[] = [];
  for (let t = toMinutes(openTime); t + SLOT_MINUTES <= toMinutes(closeTime); t += SLOT_MINUTES) out.push(t);
  return out;
}

export function dayTypeOf(date: Date): DayType {
  const d = date.getDay();
  return d === 0 || d === 6 ? "WEEKEND" : "WEEKDAY";
}

/** Saatlik sabit ücret; 30 dakika yarım saat sayılır. Ücret tanımlı değilse null. */
export function rentalPrice(startsAt: Date, endsAt: Date, rates: HourlyRates): number | null {
  const rate = rates[dayTypeOf(startsAt)];
  if (rate === undefined) return null;
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
  return Math.round(rate * (minutes / 60) * 100) / 100;
}

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** Günün başı (yerel saat) + dakika. "24:00" ertesi günün 00:00'ı olur. */
export function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

/**
 * Kiralama saatlerini doğrular: 30 dakikaya hizalı, en az 30 dakika,
 * aynı gün içinde ve çalışma saatleri arasında. Başlangıç, içinde bulunulan
 * dilimden önce olamaz (21:10'da 21:00'den başlayan kiralama yapılabilir).
 * Geçersizse açıklayıcı bir hata fırlatır.
 */
export function validateRentalTime(
  startsAt: Date,
  endsAt: Date,
  hours: { openTime: string; closeTime: string },
  now: Date = new Date(),
): void {
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) throw new Error("Tarih veya saat geçerli değil");
  if (endsAt <= startsAt) throw new Error("Bitiş saati başlangıçtan sonra olmalı");
  const aligned = (d: Date) => d.getSeconds() === 0 && d.getMinutes() % SLOT_MINUTES === 0;
  if (!aligned(startsAt) || !aligned(endsAt)) throw new Error("Kiralama 30 dakikalık dilimlerle yapılır");
  const day = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const open = atMinutes(day, toMinutes(hours.openTime));
  const close = atMinutes(day, toMinutes(hours.closeTime));
  if (startsAt < open || endsAt > close) {
    throw new Error(`Salon ${hours.openTime}-${hours.closeTime} arası açık; kiralama bu saatlerin içinde olmalı`);
  }
  if (isPastSlot(startsAt, now)) throw new Error("Geçmiş bir saat için kiralama yapılamaz");
}

/** Dilim tamamen geçmişte mi? İçinde bulunulan dilim geçmiş sayılmaz. */
export function isPastSlot(slotStart: Date, now: Date = new Date()): boolean {
  return slotStart.getTime() + SLOT_MINUTES * 60_000 <= now.getTime();
}

/** Doluluk oranı (0-100): dolu dilim / açık dilim. */
export function occupancyPercent(busySlots: number, openSlots: number): number {
  return openSlots === 0 ? 0 : Math.round((busySlots / openSlots) * 100);
}

/** Haftanın pazartesisi (yerel saat, 00:00). */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Yerel tarih -> "YYYY-MM-DD" */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> yerel gün başı; geçersizse null. */
export function parseYmd(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Bir sonraki cuma (bugün cumaysa bugün), yerel saatle "YYYY-MM-DD". */
export function nextFriday(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return ymd(d);
}
