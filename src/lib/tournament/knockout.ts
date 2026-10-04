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
