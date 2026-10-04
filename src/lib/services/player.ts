import { db } from "../db";
import { STARTING_ELO } from "../tournament";

export type Level = keyof typeof STARTING_ELO;

export const LEVELS = [
  { value: "BASLANGIC", label: "Başlangıç (1200)" },
  { value: "ORTA", label: "Orta (1500)" },
  { value: "ILERI", label: "İleri (1800)" },
] as const;

/** Oyuncuyu (e-posta varsa mevcut kaydı kullanarak) salona ekler ve SalonPlayer kaydını döner. */
export async function addSalonPlayer(salonId: string, input: { name: string; email?: string | null; level?: string }) {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const elo = STARTING_ELO[input.level as Level] ?? STARTING_ELO.ORTA;
  const player = email
    ? await db.player.upsert({ where: { email }, update: { name }, create: { name, email } })
    : await db.player.create({ data: { name } });
  return db.salonPlayer.upsert({
    where: { salonId_playerId: { salonId, playerId: player.id } },
    update: {},
    create: { salonId, playerId: player.id, elo },
  });
}
