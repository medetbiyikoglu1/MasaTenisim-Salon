import { describe, expect, it } from "vitest";
import { STARTING_ELO } from "./tournament";
import { TIERS, tierMax, tierOf } from "./tiers";

describe("ELO kademeleri", () => {
  it("sınırlarda doğru kademeyi verir", () => {
    expect(tierOf(900).name).toBe("Çaylak");
    expect(tierOf(1149).name).toBe("Çaylak");
    expect(tierOf(1150).name).toBe("Bronz");
    expect(tierOf(1500).name).toBe("Altın");
    expect(tierOf(1899).name).toBe("Elmas");
    expect(tierOf(2300).name).toBe("Usta");
  });

  it("her başlangıç seviyesi kendi kademesinde başlar, iki seviye aynı kademeye düşmez", () => {
    const tiers = Object.values(STARTING_ELO).map((e) => tierOf(e).key);
    expect(new Set(tiers).size).toBe(Object.keys(STARTING_ELO).length);
  });

  it("kademeler artan sırada ve üst sınırlar tutarlı", () => {
    TIERS.forEach((t, i) => i > 0 && expect(t.min).toBeGreaterThan(TIERS[i - 1].min));
    expect(tierMax(TIERS[1])).toBe(1299);
    expect(tierMax(TIERS.at(-1)!)).toBeNull();
  });
});
