import { Prisma } from "@prisma/client";
import { db } from "../db";
import { rateMatch, setsWon, validateMatchSets, type SetScore } from "../tournament";

type Tx = Prisma.TransactionClient;

/** Maçın daha önce yazılmış ELO etkisini geri alır (düzeltme ve silme için). */
export async function revertElo(tx: Tx, matchId: string) {
  const history = await tx.eloHistory.findMany({ where: { matchId } });
  for (const h of history) {
    await tx.salonPlayer.update({
      where: { id: h.salonPlayerId },
      data: { elo: { decrement: h.delta }, matchesCount: { decrement: 1 } },
    });
  }
  await tx.eloHistory.deleteMany({ where: { matchId } });
}

/**
 * Doğrulanmış skoru maça yazar ve iki oyuncunun ELO'sunu günceller. Maçın
 * önceki bir sonucu varsa önce onun ELO etkisi geri alınır. Kazanan ve kaybedeni döner.
 */
export async function applyResult(
  tx: Tx,
  match: { id: string; playerAId: string; playerBId: string },
  sets: SetScore[],
  finishedAt: Date,
) {
  await revertElo(tx, match.id);
  const [a, b] = await Promise.all([
    tx.salonPlayer.findUniqueOrThrow({ where: { id: match.playerAId } }),
    tx.salonPlayer.findUniqueOrThrow({ where: { id: match.playerBId } }),
  ]);
  const r = rateMatch({ elo: a.elo, matchesPlayed: a.matchesCount }, { elo: b.elo, matchesPlayed: b.matchesCount }, sets);
  const [setsA, setsB] = setsWon(sets);
  const [winnerId, loserId] = setsA > setsB ? [a.id, b.id] : [b.id, a.id];

  await tx.salonPlayer.update({ where: { id: a.id }, data: { elo: r.aAfter, matchesCount: { increment: 1 } } });
  await tx.salonPlayer.update({ where: { id: b.id }, data: { elo: r.bAfter, matchesCount: { increment: 1 } } });
  await tx.eloHistory.createMany({
    data: [
      { matchId: match.id, salonPlayerId: a.id, before: a.elo, after: r.aAfter, delta: r.aDelta },
      { matchId: match.id, salonPlayerId: b.id, before: b.elo, after: r.bAfter, delta: r.bDelta },
    ],
  });
  await tx.match.update({ where: { id: match.id }, data: { sets, status: "DONE", winnerId, finishedAt, walkover: false } });
  return { winnerId, loserId };
}

/** Hükmen sonucu yazar: set yok, ELO değişmez (önceki sonucun ELO etkisi varsa geri alınır). */
export async function applyWalkover(tx: Tx, matchId: string, winnerId: string, finishedAt: Date) {
  await revertElo(tx, matchId);
  await tx.match.update({
    where: { id: matchId },
    data: { sets: Prisma.DbNull, status: "DONE", winnerId, finishedAt, walkover: true },
  });
}

/** Kullanıcıya olduğu gibi gösterilebilecek doğrulama hatası. */
export class MatchError extends Error {}

/** Bireysel (turnuva dışı) maçlar best of 5 oynanır. */
export const INDIVIDUAL_BEST_OF = 5;
export const INDIVIDUAL_ROUND = "FRIENDLY";

export type IndividualMatchInput = {
  salonId: string;
  playerAId: string;
  playerBId: string;
  sets: SetScore[];
  playedAt: Date;
  tableId?: string | null;
};

/**
 * Bireysel maçı kaydeder ya da `matchId` verilirse düzeltir; iki durumda da
 * ELO yeniden hesaplanır (düzeltmede önce eski etki geri alınır).
 */
export async function saveIndividualMatch(input: IndividualMatchInput, matchId?: string) {
  if (!input.playerAId || !input.playerBId) throw new MatchError("İki oyuncu da seçilmeli");
  if (input.playerAId === input.playerBId) throw new MatchError("Bir oyuncu kendisiyle maç yapamaz");
  if (isNaN(input.playedAt.getTime())) throw new MatchError("Maç tarihi geçerli değil");
  if (input.playedAt.getTime() > Date.now() + 5 * 60_000) throw new MatchError("Maç tarihi ileri bir zaman olamaz");
  const players = await db.salonPlayer.count({ where: { id: { in: [input.playerAId, input.playerBId] }, salonId: input.salonId } });
  if (players !== 2) throw new MatchError("Oyuncular bu salonda kayıtlı değil");
  if (input.tableId && !(await db.table.findFirst({ where: { id: input.tableId, salonId: input.salonId } }))) {
    throw new MatchError("Masa bulunamadı");
  }
  try {
    validateMatchSets(input.sets, INDIVIDUAL_BEST_OF);
  } catch (e) {
    throw new MatchError((e as Error).message);
  }
  if (matchId) {
    const existing = await db.match.findUnique({ where: { id: matchId } });
    if (!existing || existing.salonId !== input.salonId || existing.tournamentId) throw new MatchError("Bireysel maç bulunamadı");
  }

  return db.$transaction(async (tx) => {
    const data = {
      salonId: input.salonId,
      round: INDIVIDUAL_ROUND,
      order: 0,
      playerAId: input.playerAId,
      playerBId: input.playerBId,
      tableId: input.tableId || null,
    };
    const match = matchId ? await tx.match.update({ where: { id: matchId }, data }) : await tx.match.create({ data });
    await applyResult(tx, { id: match.id, playerAId: input.playerAId, playerBId: input.playerBId }, input.sets, input.playedAt);
    return match;
  });
}

/** Bireysel maçı siler ve ELO etkisini geri alır. */
export async function deleteIndividualMatch(salonId: string, matchId: string) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.salonId !== salonId || match.tournamentId) throw new MatchError("Bireysel maç bulunamadı");
  await db.$transaction(async (tx) => {
    await revertElo(tx, matchId);
    await tx.match.delete({ where: { id: matchId } });
  });
}
