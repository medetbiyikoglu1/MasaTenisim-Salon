import type { SetScore } from "./types";

export const PROVISIONAL_MATCHES = 10;
export const K_PROVISIONAL = 40;
export const K_ESTABLISHED = 20;

export const STARTING_ELO = {
  BASLANGIC: 1200,
  ORTA: 1500,
  ILERI: 1800,
} as const;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_ESTABLISHED;
}

/** Set farkı çarpanı: 3-0 ezici galibiyet daha çok, 3-2 daha az puan taşır. */
export function marginMultiplier(winnerSets: number, loserSets: number): number {
  const diff = winnerSets - loserSets;
  if (diff >= 3) return 1.25;
  if (diff === 1) return 0.75;
  return 1;
}

export function setsWon(sets: SetScore[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [pa, pb] of sets) {
    if (pa > pb) a++;
    else if (pb > pa) b++;
  }
  return [a, b];
}

export type EloInput = { elo: number; matchesPlayed: number };
export type EloResult = { aAfter: number; bAfter: number; aDelta: number; bDelta: number };

export function rateMatch(a: EloInput, b: EloInput, sets: SetScore[]): EloResult {
  const [sa, sb] = setsWon(sets);
  if (sa === sb) throw new Error("Masa tenisinde beraberlik olmaz: set sayıları eşit");
  const aWon = sa > sb;
  const mult = aWon ? marginMultiplier(sa, sb) : marginMultiplier(sb, sa);
  const ea = expectedScore(a.elo, b.elo);
  const aDelta = Math.round(kFactor(a.matchesPlayed) * mult * ((aWon ? 1 : 0) - ea));
  const bDelta = Math.round(kFactor(b.matchesPlayed) * mult * ((aWon ? 0 : 1) - (1 - ea)));
  return { aAfter: a.elo + aDelta, bAfter: b.elo + bDelta, aDelta, bDelta };
}
