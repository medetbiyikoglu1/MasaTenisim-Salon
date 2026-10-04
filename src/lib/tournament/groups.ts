import type { PlannedMatch } from "./types";
import type { PlayerRef } from "./types";

/**
 * Katılımcı sayısına göre grup sayısı: gruplar 4 kişilik hedeflenir,
 * 16 → 4×4, 20 → 5×4. Grup boyutu 3 ile 5 arasında kalır.
 */
export function defaultGroupCount(playerCount: number): number {
  if (playerCount < 6) return 1;
  return Math.max(2, Math.round(playerCount / 4));
}

/** ELO'ya göre yılan (snake) dizilim: 1. tur A→E, 2. tur E→A ... */
export function snakeGroups<T extends PlayerRef>(players: T[], groupCount: number): T[][] {
  if (groupCount < 1) throw new Error("Grup sayısı en az 1 olmalı");
  const sorted = [...players].sort((x, y) => y.elo - x.elo);
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  sorted.forEach((p, i) => {
    const round = Math.floor(i / groupCount);
    const pos = i % groupCount;
    const idx = round % 2 === 0 ? pos : groupCount - 1 - pos;
    groups[idx].push(p);
  });
  return groups;
}

/**
 * Grup içi herkes herkesle fikstürü (circle yöntemi). Maçlar turlara dağılır,
 * böylece bir oyuncu art arda iki maça çıkmaz.
 */
export function roundRobin<T>(members: T[]): [T, T][][] {
  const list: (T | null)[] = [...members];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/**
 * Grup aşamasının tüm maçlarını üretir. Sıra, grupların turlarını iç içe
 * dizer (A1, B1, C1 ... A2, B2 ...) ki masalar dengeli dolsun.
 */
export function planGroupStage(groups: { id: string }[][]): PlannedMatch[] {
  const perGroup = groups.map((g) => roundRobin(g.map((p) => p.id)));
  const maxRounds = Math.max(0, ...perGroup.map((r) => r.length));
  const out: PlannedMatch[] = [];
  let order = 0;
  for (let r = 0; r < maxRounds; r++) {
    perGroup.forEach((rounds, gi) => {
      for (const [a, b] of rounds[r] ?? []) {
        out.push({ key: `G${gi}-R${r}-${a}-${b}`, groupIndex: gi, round: "GROUP", order: order++, playerAId: a, playerBId: b });
      }
    });
  }
  return out;
}
