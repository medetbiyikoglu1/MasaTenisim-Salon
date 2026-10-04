export type QueueMatch = {
  id: string;
  order: number;
  groupTableId: string | null; // grubun kendi masası varsa
  playerAId: string | null;
  playerBId: string | null;
  status: "PENDING" | "ON_TABLE" | "AWAITING_CONFIRMATION" | "DONE";
  tableId: string | null;
  finishedAt: Date | null;
};

export type Assignment = { matchId: string; tableId: string };

/**
 * Boşalan masalara sıradaki maçı atar. Kurallar:
 * - iki oyuncu da belli ve şu an masada değil;
 * - mümkünse son biten maçında oynamış oyuncu bir maç dinlenir;
 * - grubun kendi masası varsa maç önce o masaya gider.
 */
export function assignTables(matches: QueueMatch[], tableIds: string[]): Assignment[] {
  const busyTables = new Set(matches.filter((m) => m.status === "ON_TABLE").map((m) => m.tableId));
  const busyPlayers = new Set(
    matches.filter((m) => m.status === "ON_TABLE").flatMap((m) => [m.playerAId, m.playerBId]),
  );
  // En son biten maçtaki oyuncular "dinleniyor" sayılır.
  const lastFinished = matches
    .filter((m) => m.finishedAt)
    .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime());
  const resting = new Set<string | null>();
  if (lastFinished.length) {
    const cutoff = lastFinished[0].finishedAt!.getTime();
    for (const m of lastFinished) {
      if (m.finishedAt!.getTime() === cutoff) { resting.add(m.playerAId); resting.add(m.playerBId); }
    }
  }

  const pending = matches
    .filter((m) => m.status === "PENDING" && m.playerAId && m.playerBId)
    .sort((a, b) => a.order - b.order);
  const freeTables = tableIds.filter((t) => !busyTables.has(t));
  const assignments: Assignment[] = [];
  const taken = new Set<string>();

  const canPlay = (m: QueueMatch, allowResting: boolean) =>
    !taken.has(m.id) &&
    !busyPlayers.has(m.playerAId) &&
    !busyPlayers.has(m.playerBId) &&
    (allowResting || (!resting.has(m.playerAId) && !resting.has(m.playerBId)));

  const occupied = (t: string | null) => t !== null && busyTables.has(t);
  const own = (tableId: string, allowResting: boolean) =>
    pending.find((m) => m.groupTableId === tableId && canPlay(m, allowResting));
  // Başka masaya yalnızca kendi masası olmayan ya da kendi masası dolu olan maç gider.
  const other = (allowResting: boolean) =>
    pending.find(
      (m) => (m.groupTableId === null || occupied(m.groupTableId) || !tableIds.includes(m.groupTableId)) && canPlay(m, allowResting),
    );

  for (const tableId of freeTables) {
    const pick = own(tableId, false) ?? other(false) ?? own(tableId, true) ?? other(true);
    if (!pick) continue;
    taken.add(pick.id);
    busyTables.add(tableId);
    busyPlayers.add(pick.playerAId);
    busyPlayers.add(pick.playerBId);
    assignments.push({ matchId: pick.id, tableId });
  }
  return assignments;
}
