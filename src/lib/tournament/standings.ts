import { setsWon } from "./elo";
import type { SetScore } from "./types";

export type FinishedMatch = { playerAId: string; playerBId: string; sets: SetScore[] };

export type Standing = {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  points: number; // ITTF: galibiyet 2, mağlubiyet 1
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
};

function emptyRow(playerId: string): Standing {
  return { playerId, played: 0, wins: 0, losses: 0, points: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0 };
}

function tally(playerIds: string[], matches: FinishedMatch[]): Map<string, Standing> {
  const rows = new Map(playerIds.map((id) => [id, emptyRow(id)]));
  for (const m of matches) {
    const a = rows.get(m.playerAId);
    const b = rows.get(m.playerBId);
    if (!a || !b) continue;
    const [sa, sb] = setsWon(m.sets);
    const pa = m.sets.reduce((s, [x]) => s + x, 0);
    const pb = m.sets.reduce((s, [, y]) => s + y, 0);
    a.played++; b.played++;
    a.setsFor += sa; a.setsAgainst += sb; b.setsFor += sb; b.setsAgainst += sa;
    a.pointsFor += pa; a.pointsAgainst += pb; b.pointsFor += pb; b.pointsAgainst += pa;
    if (sa > sb) { a.wins++; b.losses++; a.points += 2; b.points += 1; }
    else { b.wins++; a.losses++; b.points += 2; a.points += 1; }
  }
  return rows;
}

const ratio = (f: number, a: number) => (a === 0 ? (f === 0 ? 0 : Infinity) : f / a);

/**
 * Grup sıralaması (ITTF kuralı): puan; eşitlikte yalnızca eşit oyuncular
 * arasındaki maçlarla puan, set oranı, sayı oranı.
 */
export function groupStandings(playerIds: string[], matches: FinishedMatch[]): Standing[] {
  const overall = tally(playerIds, matches);
  const byPoints = new Map<number, string[]>();
  for (const row of overall.values()) {
    byPoints.set(row.points, [...(byPoints.get(row.points) ?? []), row.playerId]);
  }
  const result: Standing[] = [];
  for (const pts of [...byPoints.keys()].sort((x, y) => y - x)) {
    const tied = byPoints.get(pts)!;
    if (tied.length === 1) { result.push(overall.get(tied[0])!); continue; }
    const inner = tally(tied, matches.filter((m) => tied.includes(m.playerAId) && tied.includes(m.playerBId)));
    tied.sort((x, y) => {
      const a = inner.get(x)!; const b = inner.get(y)!;
      return (
        b.points - a.points ||
        ratio(b.setsFor, b.setsAgainst) - ratio(a.setsFor, a.setsAgainst) ||
        ratio(b.pointsFor, b.pointsAgainst) - ratio(a.pointsFor, a.pointsAgainst)
      );
    });
    for (const id of tied) result.push(overall.get(id)!);
  }
  return result;
}
