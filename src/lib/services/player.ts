import { db } from "../db";
import { STARTING_ELO } from "../tournament";

export type Level = keyof typeof STARTING_ELO;

/** Oyuncu eklerken seçilen başlangıç seviyeleri (zayıftan güçlüye). */
export const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: "YENI", label: "Yeni başlayan", hint: "Raketi yeni eline almış" },
  { value: "BASLANGIC", label: "Başlangıç", hint: "Topu karşıya atabiliyor, ralli kısa" },
  { value: "GELISEN", label: "Gelişen", hint: "Düzenli oynuyor, temel vuruşlar oturuyor" },
  { value: "ORTA", label: "Orta", hint: "Ralli yapıyor, servis ve spin kullanıyor" },
  { value: "IYI", label: "İyi", hint: "Atak ve savunması güçlü, sık kazanıyor" },
  { value: "ILERI", label: "İleri", hint: "Kulüp seviyesinde, salonun en iyilerinden" },
  { value: "USTA", label: "Usta", hint: "Lisanslı ya da turnuva tecrübeli" },
];

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
