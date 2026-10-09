/** n için standart tohum yerleşimi: [1, 16, 8, 9, 4, 13, ...] */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((s) => [s, next - s]);
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

const ROUND_NAMES: Record<number, string> = { 2: "F", 4: "SF", 8: "QF", 16: "R16", 32: "R32" };

export type BracketSlot = { round: string; order: number; playerAId: string | null; playerBId: string | null; bye: boolean };

/**
 * İlk eleme turunu kurar. `seeded` güçlüden zayıfa sıralı olmalı
 * (önce grup birincileri, sonra ikincileri). Tablo 2'nin kuvvetine
 * tamamlanır; boşluklar en üst tohumlara bay olarak verilir.
 */
export function firstKnockoutRound(seeded: string[]): BracketSlot[] {
  const size = nextPowerOfTwo(Math.max(2, seeded.length));
  const order = seedOrder(size);
  const round = ROUND_NAMES[size] ?? `R${size}`;
  const slots: BracketSlot[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = seeded[order[i] - 1] ?? null;
    const b = seeded[order[i + 1] - 1] ?? null;
    slots.push({ round, order: i / 2, playerAId: a, playerBId: b, bye: a === null || b === null });
  }
  return slots;
}

export function roundNameForSize(size: number): string {
  return ROUND_NAMES[size] ?? `R${size}`;
}

/**
 * Grup sıralamalarından eleme tohumlarını çıkarır: önce grup birincileri,
 * sonra ikincileri..., her kademe kendi içinde ELO'ya göre. Aynı gruptan iki
 * oyuncu ilk turda eşleşiyorsa aynı kademeden başka biriyle yer değiştirilir.
 */
export function knockoutSeeding(groups: string[][], perGroup: number, elo: (id: string) => number = () => 0): string[] {
  const groupOf = new Map<string, number>();
  groups.forEach((g, gi) => g.forEach((id) => groupOf.set(id, gi)));
  const tiers: string[][] = [];
  for (let t = 0; t < perGroup; t++) {
    const tier = groups.map((g) => g[t]).filter((id): id is string => id !== undefined);
    tiers.push(tier.sort((x, y) => elo(y) - elo(x)));
  }
  const seeded = tiers.flat();
  const tierStart = tiers.map((_, t) => tiers.slice(0, t).reduce((s, x) => s + x.length, 0));
  const tierOf = (i: number) => tierStart.findLastIndex((s) => i >= s);

  const size = nextPowerOfTwo(Math.max(2, seeded.length));
  const order = seedOrder(size).map((s) => s - 1);
  const pairIndex = new Map<number, number>(); // tohum indeksi -> rakibinin tohum indeksi
  for (let i = 0; i < size; i += 2) {
    pairIndex.set(order[i], order[i + 1]);
    pairIndex.set(order[i + 1], order[i]);
  }
  const clash = (i: number) => {
    const j = pairIndex.get(i)!;
    return j < seeded.length && groupOf.get(seeded[i]) === groupOf.get(seeded[j]);
  };

  for (let i = 0; i < seeded.length; i++) {
    if (!clash(i)) continue;
    // Çakışan çiftin düşük tohumunu önce aynı kademeden, olmazsa üst kademe
    // dışındaki herhangi biriyle değiştir (üst tohumların yeri korunur)
    const low = Math.max(i, pairIndex.get(i)!);
    const sameTier = [...seeded.keys()].filter((k) => k !== low && tierOf(k) === tierOf(low));
    const lowerTiers = [...seeded.keys()].filter((k) => k !== low && tierOf(k) > 0 && tierOf(k) !== tierOf(low));
    for (const k of [...sameTier, ...lowerTiers]) {
      [seeded[low], seeded[k]] = [seeded[k], seeded[low]];
      if (!clash(low) && !clash(k)) break;
      [seeded[low], seeded[k]] = [seeded[k], seeded[low]];
    }
  }
  return seeded;
}

/** Eleme maçının kazananının gideceği bir sonraki tur maçı ve yuvası. */
export function nextKnockoutSlot(roundSize: number, order: number): { round: string; order: number; slot: "A" | "B" } | null {
  if (roundSize <= 2) return null;
  return { round: roundNameForSize(roundSize / 2), order: Math.floor(order / 2), slot: order % 2 === 0 ? "A" : "B" };
}

/** Tur adından o turdaki oyuncu sayısı ("QF" -> 8). */
export function roundSize(round: string): number {
  const named = Object.entries(ROUND_NAMES).find(([, name]) => name === round);
  return named ? Number(named[0]) : Number(round.slice(1));
}

/** Ekranda gösterilen tur adları. */
export const ROUND_LABELS: Record<string, string> = {
  R32: "Son 32",
  R16: "Son 16",
  QF: "Çeyrek final",
  SF: "Yarı final",
  F: "Final",
  "3RD": "3.lük maçı",
};

export type Bracket = "MAIN" | "CONSOLATION";
export const BRACKET_LABELS: Record<Bracket, string> = { MAIN: "Eleme", CONSOLATION: "Teselli" };

/**
 * Grup sıralamalarını ikiye ayırır: her gruptan ilk `advance` oyuncu ana
 * elemeye, geri kalanlar (teselli açıksa) teselli turnuvasına gider.
 * Her iki liste de grup başına, sıralama düzeninde döner.
 */
export function splitByStanding(
  groups: string[][],
  advance: number,
  consolation: boolean,
): { main: string[][]; consolation: string[][] } {
  return {
    main: groups.map((g) => g.slice(0, advance)),
    consolation: consolation ? groups.map((g) => g.slice(advance)) : [],
  };
}

/** Eleme maçının ekrandaki adı; teselli tablosundakiler "Teselli · Yarı final" gibi. */
export function knockoutLabel(round: string, bracket: string): string {
  const name = ROUND_LABELS[round] ?? round;
  return bracket === "CONSOLATION" ? `${BRACKET_LABELS.CONSOLATION} · ${name}` : name;
}
