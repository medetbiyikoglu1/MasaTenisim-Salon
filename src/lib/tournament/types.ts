export type PlayerRef = { id: string; elo: number };

/** Bir set skoru: [A'nın sayısı, B'nin sayısı] */
export type SetScore = [number, number];

export type PlannedMatch = {
  key: string;
  groupIndex: number | null;
  round: string;
  order: number;
  playerAId: string | null;
  playerBId: string | null;
};
