import { db } from "../db";
import { defaultGroupCount, planGroupStage, snakeGroups } from "../tournament";

export type CreateTournamentInput = {
  salonId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  entryFee: number | null;
  prizes: string[]; // 1., 2., 3. sıra ödülleri
  salonPlayerIds: string[];
  tableIds: string[];
  groupCount?: number;
};

const GROUP_NAMES = "ABCDEFGHIJKLMNOP";

/**
 * Turnuvayı kurar: katılımcıları ELO'ya göre yılan dizilimle gruplara böler,
 * her gruba sırayla bir masa verir, grup maçlarını üretir ve masaları
 * turnuva saatlerinde kiralamaya kapatır.
 */
export async function createTournament(input: CreateTournamentInput) {
  if (input.salonPlayerIds.length < 3) throw new Error("En az 3 katılımcı gerekli");
  if (input.tableIds.length < 1) throw new Error("En az 1 masa seçilmeli");

  const players = await db.salonPlayer.findMany({
    where: { id: { in: input.salonPlayerIds }, salonId: input.salonId },
  });
  const groupCount = input.groupCount ?? defaultGroupCount(players.length);
  const groups = snakeGroups(players, groupCount);
  const plan = planGroupStage(groups);
  const seedOf = new Map([...players].sort((a, b) => b.elo - a.elo).map((p, i) => [p.id, i + 1]));

  return db.$transaction(async (tx) => {
    const tournament = await tx.tournament.create({
      data: {
        salonId: input.salonId,
        name: input.name,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        entryFee: input.entryFee,
        status: "GROUPS",
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

    const groupIds: string[] = [];
    for (const [gi, members] of groups.entries()) {
      const group = await tx.group.create({
        data: {
          tournamentId: tournament.id,
          name: GROUP_NAMES[gi] ?? `G${gi + 1}`,
          tableId: input.tableIds[gi % input.tableIds.length],
        },
      });
      groupIds.push(group.id);
      await tx.participant.createMany({
        data: members.map((p) => ({
          tournamentId: tournament.id,
          salonPlayerId: p.id,
          groupId: group.id,
          seed: seedOf.get(p.id),
        })),
      });
    }

    await tx.match.createMany({
      data: plan.map((m) => ({
        tournamentId: tournament.id,
        groupId: m.groupIndex === null ? null : groupIds[m.groupIndex],
        round: m.round,
        order: m.order,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
      })),
    });

    return tournament;
  });
}
