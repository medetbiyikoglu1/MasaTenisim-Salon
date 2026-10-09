import { describe, expect, it } from "vitest";
import { daySlots, isPastSlot, nextFriday, occupancyPercent, overlaps, rentalPrice, validateRentalTime, weekStart } from "./rental";

const hours = { openTime: "10:00", closeTime: "24:00" };
const past = new Date(2026, 0, 1);
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m); // Ekim 2026

describe("kiralama", () => {
  it("10:00-24:00 arası 28 adet 30 dakikalık dilim var", () => {
    const s = daySlots("10:00", "24:00");
    expect(s).toHaveLength(28);
    expect(s[0]).toBe(600);
    expect(s.at(-1)).toBe(1410);
  });

  it("hafta içi ve hafta sonu ücreti ayrı, 30 dakika yarım saat", () => {
    const rates = { WEEKDAY: 200, WEEKEND: 250 };
    expect(rentalPrice(at(7, 19), at(7, 21), rates)).toBe(400); // çarşamba
    expect(rentalPrice(at(10, 19), at(10, 20, 30), rates)).toBe(375); // cumartesi
    expect(rentalPrice(at(7, 19), at(7, 19, 30), rates)).toBe(100);
    expect(rentalPrice(at(7, 19), at(7, 20), {})).toBeNull();
  });

  it("çakışmayı yakalar, uç uca kiralamaları kabul eder", () => {
    const a = { startsAt: at(7, 19), endsAt: at(7, 21) };
    expect(overlaps(a, { startsAt: at(7, 20), endsAt: at(7, 22) })).toBe(true);
    expect(overlaps(a, { startsAt: at(7, 21), endsAt: at(7, 22) })).toBe(false);
    expect(overlaps(a, { startsAt: at(7, 18), endsAt: at(7, 19) })).toBe(false);
  });

  it("geçerli kiralamayı kabul eder; gece yarısında biten kiralama olur", () => {
    expect(() => validateRentalTime(at(7, 19), at(7, 21), hours, past)).not.toThrow();
    expect(() => validateRentalTime(at(7, 23), at(8, 0), hours, past)).not.toThrow();
  });

  it("hizasız, ters, çalışma saati dışı ve geçmiş kiralamayı reddeder", () => {
    expect(() => validateRentalTime(at(7, 19, 15), at(7, 20), hours, past)).toThrow("30 dakikalık");
    expect(() => validateRentalTime(at(7, 21), at(7, 19), hours, past)).toThrow("Bitiş");
    expect(() => validateRentalTime(at(7, 9), at(7, 11), hours, past)).toThrow("10:00-24:00");
    expect(() => validateRentalTime(at(7, 23), at(8, 1), hours, past)).toThrow("10:00-24:00");
    expect(() => validateRentalTime(at(7, 19), at(7, 20), hours, at(7, 19, 30))).toThrow("Geçmiş");
  });

  it("doluluk oranı ve haftanın pazartesisi", () => {
    expect(occupancyPercent(7, 28)).toBe(25);
    expect(occupancyPercent(0, 0)).toBe(0);
    expect(weekStart(at(11, 15))).toEqual(new Date(2026, 9, 5)); // pazar -> 5 Ekim pazartesi
    expect(weekStart(at(5, 9))).toEqual(new Date(2026, 9, 5));
  });

  it("içinde bulunulan dilim kiralanabilir: 21:10'da 21:00-22:00 olur, 20:30 olmaz", () => {
    expect(() => validateRentalTime(at(7, 21), at(7, 22), hours, at(7, 21, 10))).not.toThrow();
    expect(() => validateRentalTime(at(7, 20, 30), at(7, 22), hours, at(7, 21, 10))).toThrow("Geçmiş");
    expect(isPastSlot(at(7, 21), at(7, 21, 29))).toBe(false);
    expect(isPastSlot(at(7, 21), at(7, 21, 30))).toBe(true);
  });

  it("gelecek cuma gece yarısından sonra da doğru gün (yerel saat)", () => {
    expect(nextFriday(new Date(2026, 9, 10, 0, 7))).toBe("2026-10-16"); // cumartesi 00:07
    expect(nextFriday(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09"); // cuma gecesi: bugün
    expect(nextFriday(new Date(2026, 9, 5, 0, 30))).toBe("2026-10-09"); // pazartesi
  });
});
