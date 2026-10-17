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

/**
 * ELO'ya göre yılan (snake) dizilim: 1. tur A→E, 2. tur E→A ...
 * İlk tur seri başlarıdır: en yüksek ELO'lu `groupCount` oyuncu her biri ayrı
 * bir gruba düşer (1. seri başı A'ya, 2. seri başı B'ye ...).
 */
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
 * Onaydan önce elle düzenlenmiş grupları kontrol eder: herkes bir grupta olmalı
 * ve her grupta maç çıkması için en az 2 oyuncu bulunmalı. Sorun yoksa null.
 */
export function groupProblem(groups: { name: string; size: number }[], unassigned: number): string | null {
  if (unassigned > 0) return `${unassigned} oyuncu henüz bir gruba atanmamış`;
  if (groups.length < 1) return "En az 1 grup olmalı";
  const small = groups.find((g) => g.size < 2);
  if (small) return `Grup ${small.name}'de en az 2 oyuncu olmalı (şu an ${small.size})`;
  return null;
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

export const GROUP_NAMES = "ABCDEFGHIJKLMNOP";
/** Grup aşamasında sonradan eklenen grupta olması gereken en az oyuncu. */
export const MIN_ADDED_GROUP = 3;

/** Sıradaki boş grup harfi; harfler bitince G17, G18 ... */
export function nextGroupName(existing: string[]): string {
  const used = new Set(existing);
  for (const ch of GROUP_NAMES) if (!used.has(ch)) return ch;
  for (let i = GROUP_NAMES.length + 1; ; i++) if (!used.has(`G${i}`)) return `G${i}`;
}

/**
 * Grup aşaması sürerken eklenen tek bir grubun planı: oyuncular ELO'ya göre
 * mevcut en büyük seri numarasının arkasından numaralanır, herkes herkesle
 * maçları mevcut maç sırasının sonuna eklenir. Mevcut gruplara dokunulmaz.
 */
export function planAddedGroup<T extends PlayerRef>(
  players: T[],
  existing: { groupNames: string[]; maxSeed: number; maxOrder: number },
) {
  if (players.length < MIN_ADDED_GROUP) {
    throw new Error(`Yeni grupta en az ${MIN_ADDED_GROUP} oyuncu olmalı (şu an ${players.length})`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error("Aynı oyuncu iki kez seçilmiş");
  const sorted = [...players].sort((x, y) => y.elo - x.elo);
  const seeds = sorted.map((p, i) => ({ id: p.id, seed: existing.maxSeed + i + 1 }));
  let order = existing.maxOrder;
  const matches = roundRobin(sorted.map((p) => p.id)).flatMap((pairs) =>
    pairs.map(([a, b]) => ({ round: "GROUP" as const, order: ++order, playerAId: a, playerBId: b })),
  );
  return { name: nextGroupName(existing.groupNames), seeds, matches };
}
