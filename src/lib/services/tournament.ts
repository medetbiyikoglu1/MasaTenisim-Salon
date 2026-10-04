import { db } from "../db";
import type { Prisma } from "@prisma/client";
import {
  defaultGroupCount,
  firstKnockoutRound,
  groupStandings,
  knockoutSeeding,
  nextKnockoutSlot,
  planGroupStage,
  rateMatch,
  roundNameForSize,
  roundSize,
  setsWon,
  snakeGroups,
  validateMatchSets,
  type SetScore,
} from "../tournament";

/** Kullanıcıya olduğu gibi gösterilebilecek doğrulama hatası. */
export class TournamentError extends Error {}

export type CreateTournamentInput = {
  salonId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  entryFee: number | null;
  prizes: string[]; // 1., 2., 3. sıra ödülleri
  tableIds: string[];
};

const GROUP_NAMES = "ABCDEFGHIJKLMNOP";
export const MIN_PARTICIPANTS = 3;
/** Her gruptan eleme tablosuna çıkan oyuncu sayısı. */
export const ADVANCE_PER_GROUP = 2;

/**
 * Turnuvayı taslak olarak açar ve seçilen masaları turnuva saatlerinde
 * kiralamaya kapatır. Katılımcılar turnuva başlayana kadar eklenip çıkarılabilir.
 */
export async function createTournament(input: CreateTournamentInput) {
  if (isNaN(input.startsAt.getTime()) || isNaN(input.endsAt.getTime())) throw new TournamentError("Tarih ve saat geçerli değil");
  if (input.endsAt <= input.startsAt) throw new TournamentError("Bitiş saati başlangıçtan sonra olmalı");
  if (input.tableIds.length < 1) throw new TournamentError("En az 1 masa seçilmeli");

  return db.tournament.create({
    data: {
      salonId: input.salonId,
      name: input.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      entryFee: input.entryFee,
      status: "DRAFT",
      prizes: {
        create: input.prizes
          .map((name, i) => ({ place: i + 1, name: name.trim() }))
          .filter((p) => p.name),
      },
      blocks: {
        create: input.tableIds.map((tableId) => ({ tableId, startsAt: input.startsAt, endsAt: input.endsAt })),
      },
    },
  });
}

async function draftTournament(tournamentId: string) {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("Turnuva bulunamadı");
  if (t.status !== "DRAFT") throw new TournamentError("Turnuva başladı; katılımcılar artık değiştirilemez");
  return t;
}

export async function addParticipants(tournamentId: string, salonPlayerIds: string[]) {
  const t = await draftTournament(tournamentId);
  const players = await db.salonPlayer.findMany({ where: { id: { in: salonPlayerIds }, salonId: t.salonId } });
  await db.participant.createMany({
    data: players.map((p) => ({ tournamentId, salonPlayerId: p.id })),
    skipDuplicates: true,
  });
}

export async function removeParticipant(tournamentId: string, participantId: string) {
  await draftTournament(tournamentId);
  await db.participant.deleteMany({ where: { id: participantId, tournamentId } });
}

/**
 * Turnuvayı başlatır: katılımcıları ELO'ya göre yılan dizilimle gruplara böler,
 * her gruba sırayla turnuva masalarından birini verir ve grup maçlarını üretir.
 */
export async function startTournament(tournamentId: string, groupCount?: number) {
  await draftTournament(tournamentId);
  const [participants, blocks] = await Promise.all([
    db.participant.findMany({ where: { tournamentId }, include: { salonPlayer: true } }),
    db.tableBlock.findMany({ where: { tournamentId }, include: { table: true }, orderBy: { table: { number: "asc" } } }),
  ]);
  if (participants.length < MIN_PARTICIPANTS) {
    throw new TournamentError(`Başlatmak için en az ${MIN_PARTICIPANTS} katılımcı gerekli (şu an ${participants.length})`);
  }
  const tableIds = [...new Set(blocks.map((b) => b.tableId))];
  if (tableIds.length < 1) throw new TournamentError("Turnuvaya masa atanmamış");

  const players = participants.map((p) => p.salonPlayer);
  const groups = snakeGroups(players, groupCount ?? defaultGroupCount(players.length));
  const plan = planGroupStage(groups);
  const seedOf = new Map([...players].sort((a, b) => b.elo - a.elo).map((p, i) => [p.id, i + 1]));

  return db.$transaction(async (tx) => {
    // Aynı anda iki kez başlatılmasın
    const { count } = await tx.tournament.updateMany({ where: { id: tournamentId, status: "DRAFT" }, data: { status: "GROUPS" } });
    if (count === 0) throw new TournamentError("Turnuva zaten başlatılmış");

    const groupIds: string[] = [];
    for (const [gi, members] of groups.entries()) {
      const group = await tx.group.create({
        data: {
          tournamentId,
          name: GROUP_NAMES[gi] ?? `G${gi + 1}`,
          tableId: tableIds[gi % tableIds.length],
        },
      });
      groupIds.push(group.id);
      for (const p of members) {
        await tx.participant.update({
          where: { tournamentId_salonPlayerId: { tournamentId, salonPlayerId: p.id } },
          data: { groupId: group.id, seed: seedOf.get(p.id) },
        });
      }
    }

    await tx.match.createMany({
      data: plan.map((m) => ({
        tournamentId,
        groupId: m.groupIndex === null ? null : groupIds[m.groupIndex],
        round: m.round,
        order: m.order,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
      })),
    });
  });
}

/**
 * Maç sonucunu kaydeder ve iki oyuncunun ELO'sunu günceller. Daha önce girilmiş
 * bir sonuç düzeltiliyorsa önce o maçın ELO etkisi geri alınır, sonra yeniden hesaplanır.
 */
export async function recordMatchResult(matchId: string, sets: SetScore[]) {
  const match = await db.match.findUnique({ where: { id: matchId }, include: { tournament: true, eloHistory: true } });
  if (!match) throw new TournamentError("Maç bulunamadı");
  if (match.tournament.status === "DRAFT") throw new TournamentError("Turnuva henüz başlamadı");
  if (match.tournament.status === "FINISHED") throw new TournamentError("Turnuva bitti; sonuç değiştirilemez");
  const { playerAId, playerBId } = match;
  if (!playerAId || !playerBId) throw new TournamentError("Maçın oyuncuları henüz belli değil");
  if (match.round === "GROUP" && match.tournament.status !== "GROUPS") {
    throw new TournamentError("Grup aşaması bitti; grup maçı sonucu değiştirilemez");
  }
  if (match.status === "DONE" && match.round !== "GROUP") await assertNextNotPlayed(match);
  try {
    validateMatchSets(sets, match.tournament.bestOf);
  } catch (e) {
    throw new TournamentError((e as Error).message);
  }

  await db.$transaction(async (tx) => {
    // Düzeltme: önceki sonucun ELO etkisini geri al
    for (const h of match.eloHistory) {
      await tx.salonPlayer.update({
        where: { id: h.salonPlayerId },
        data: { elo: { decrement: h.delta }, matchesCount: { decrement: 1 } },
      });
    }
    await tx.eloHistory.deleteMany({ where: { matchId } });

    const [a, b] = await Promise.all([
      tx.salonPlayer.findUniqueOrThrow({ where: { id: playerAId } }),
      tx.salonPlayer.findUniqueOrThrow({ where: { id: playerBId } }),
    ]);
    const r = rateMatch({ elo: a.elo, matchesPlayed: a.matchesCount }, { elo: b.elo, matchesPlayed: b.matchesCount }, sets);
    const [setsA, setsB] = setsWon(sets);

    await tx.salonPlayer.update({ where: { id: a.id }, data: { elo: r.aAfter, matchesCount: { increment: 1 } } });
    await tx.salonPlayer.update({ where: { id: b.id }, data: { elo: r.bAfter, matchesCount: { increment: 1 } } });
    await tx.eloHistory.createMany({
      data: [
        { matchId, salonPlayerId: a.id, before: a.elo, after: r.aAfter, delta: r.aDelta },
        { matchId, salonPlayerId: b.id, before: b.elo, after: r.bAfter, delta: r.bDelta },
      ],
    });
    await tx.match.update({
      where: { id: matchId },
      data: {
        sets,
        status: "DONE",
        winnerId: setsA > setsB ? a.id : b.id,
        finishedAt: match.finishedAt ?? new Date(),
      },
    });
    if (match.round !== "GROUP") {
      const winner = setsA > setsB ? a.id : b.id;
      await advanceKnockout(tx, match, winner, winner === a.id ? b.id : a.id);
    }
  });
}

type KnockoutMatch = { tournamentId: string; round: string; order: number };

/** Eleme maçı düzeltilecekse, kazananın gittiği maç henüz oynanmamış olmalı. */
async function assertNextNotPlayed(match: KnockoutMatch) {
  const next = match.round === "3RD" ? null : nextKnockoutSlot(roundSize(match.round), match.order);
  const targets = [
    ...(next ? [{ round: next.round, order: next.order }] : []),
    ...(match.round === "SF" ? [{ round: "3RD", order: 0 }] : []),
  ];
  const played = await db.match.count({
    where: { tournamentId: match.tournamentId, status: "DONE", OR: targets },
  });
  if (targets.length > 0 && played > 0) throw new TournamentError("Sonraki tur maçı oynandı; bu sonuç artık düzeltilemez");
}

/**
 * Kazananı bir sonraki tura, yarı final kaybedenini 3.lük maçına yerleştirir.
 * Final ve 3.lük maçı bitince turnuvayı bitirir.
 */
async function advanceKnockout(tx: Prisma.TransactionClient, match: KnockoutMatch, winnerId: string, loserId: string | null) {
  const { tournamentId } = match;
  const place = async (round: string, order: number, slot: "A" | "B", playerId: string) => {
    await tx.match.updateMany({
      where: { tournamentId, round, order },
      data: slot === "A" ? { playerAId: playerId } : { playerBId: playerId },
    });
  };
  if (match.round !== "3RD") {
    const next = nextKnockoutSlot(roundSize(match.round), match.order);
    if (next) await place(next.round, next.order, next.slot, winnerId);
  }
  if (match.round === "SF" && loserId) await place("3RD", 0, match.order === 0 ? "A" : "B", loserId);

  const open = await tx.match.count({ where: { tournamentId, round: { in: ["F", "3RD"] }, status: { not: "DONE" } } });
  if (open === 0) await tx.tournament.update({ where: { id: tournamentId }, data: { status: "FINISHED" } });
}

/**
 * Grup aşamasını bitirir: her gruptan ilk iki oyuncu eleme tablosuna geçer.
 * Tüm eleme turlarının maçları baştan açılır; bay alan oyuncu doğrudan üst tura yerleşir.
 */
export async function finishGroupStage(tournamentId: string) {
  const t = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: { orderBy: { name: "asc" }, include: { participants: { include: { salonPlayer: true } }, matches: true } },
    },
  });
  if (!t) throw new TournamentError("Turnuva bulunamadı");
  if (t.status !== "GROUPS") throw new TournamentError("Turnuva grup aşamasında değil");
  const left = t.groups.reduce((n, g) => n + g.matches.filter((m) => m.status !== "DONE").length, 0);
  if (left > 0) throw new TournamentError(`Grup aşaması bitmedi: ${left} maç kaldı`);

  const elo = new Map(t.groups.flatMap((g) => g.participants.map((p) => [p.salonPlayerId, p.salonPlayer.elo] as const)));
  const qualified = t.groups.map((g) =>
    groupStandings(
      g.participants.map((p) => p.salonPlayerId),
      g.matches.map((m) => ({ playerAId: m.playerAId!, playerBId: m.playerBId!, sets: m.sets as SetScore[] })),
    )
      .slice(0, ADVANCE_PER_GROUP)
      .map((r) => r.playerId),
  );
  const seeded = knockoutSeeding(qualified, ADVANCE_PER_GROUP, (id) => elo.get(id) ?? 0);
  if (seeded.length < 2) throw new TournamentError("Eleme için en az 2 oyuncu gerekli");
  const firstRound = firstKnockoutRound(seeded);
  const size = firstRound.length * 2;

  await db.$transaction(async (tx) => {
    const { count } = await tx.tournament.updateMany({ where: { id: tournamentId, status: "GROUPS" }, data: { status: "KNOCKOUT" } });
    if (count === 0) throw new TournamentError("Grup aşaması zaten bitirilmiş");

    const rounds: { round: string; order: number }[] = [];
    for (let s = size; s >= 2; s /= 2) {
      for (let o = 0; o < s / 2; o++) rounds.push({ round: roundNameForSize(s), order: o });
    }
    if (size >= 4) rounds.push({ round: "3RD", order: 0 });
    await tx.match.createMany({ data: rounds.map((r) => ({ tournamentId, ...r })) });

    for (const slot of firstRound) {
      const where = { tournamentId, round: slot.round, order: slot.order };
      if (!slot.bye) {
        await tx.match.updateMany({ where, data: { playerAId: slot.playerAId, playerBId: slot.playerBId } });
        continue;
      }
      const winner = (slot.playerAId ?? slot.playerBId)!;
      await tx.match.updateMany({
        where,
        data: { playerAId: slot.playerAId, playerBId: slot.playerBId, status: "DONE", winnerId: winner, finishedAt: new Date() },
      });
      await advanceKnockout(tx, { tournamentId, ...slot }, winner, null);
    }
  });
}
