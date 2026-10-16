/**
 * Yerel canlı provası için demo verisi. YALNIZCA adı "prova" içeren bir
 * veritabanında çalışır; önce o veritabanını tamamen siler.
 *
 * Veriler uygulamanın kendi servisleriyle oluşturulur (ELO, eşleşme ve tablo
 * kuralları canlıdakiyle aynı). Kullanım: npm run prova:hazirla
 */
import { db } from "../src/lib/db";
import { createPlayerToken } from "../src/lib/auth/session";
import { saveIndividualMatch } from "../src/lib/services/match";
import { addSalonPlayer, type Level } from "../src/lib/services/player";
import { createRental } from "../src/lib/services/rental";
import * as T from "../src/lib/services/tournament";
import { expectedScore, type SetScore } from "../src/lib/tournament";

const url = process.env.DATABASE_URL ?? "";
if (!/prova/.test(new URL(url).pathname)) {
  console.error(`Güvenlik: demo verisi yalnızca adı "prova" içeren veritabanına yazılır. Şu an: ${new URL(url).pathname}`);
  process.exit(1);
}
const BASE = process.env.PROVA_URL ?? "http://localhost:3002";

// Tekrarlanabilir rastgelelik: her çalıştırmada aynı demo
let seed = 20261010;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

/** ELO'ya göre gerçekçi bir best of 5 skoru: güçlü oyuncu çoğunlukla kazanır. */
function scoreFor(eloA: number, eloB: number): SetScore[] {
  const aWins = rand() < expectedScore(eloA, eloB);
  const loserSets = between(0, 2);
  const sets: SetScore[] = [];
  for (let i = 0; i < 3 + loserSets; i++) {
    const winnerTakes = i >= loserSets; // kaybedenin setleri önce gelsin, maç kazananla bitsin
    const deuce = rand() < 0.15;
    const w = deuce ? 12 : 11;
    const l = deuce ? 10 : between(3, 9);
    const [x, y] = winnerTakes ? [w, l] : [l, w];
    sets.push(aWins ? [x, y] : [y, x]);
  }
  return sets;
}

const PLAYERS: [string, Level][] = [
  ["Mert Yıldız", "USTA"], ["Elif Kaya", "ILERI"], ["Burak Demir", "ILERI"], ["Selin Aydın", "IYI"],
  ["Can Öztürk", "IYI"], ["Zeynep Arslan", "IYI"], ["Emre Şahin", "ORTA"], ["Deniz Çelik", "ORTA"],
  ["Ayşe Koç", "ORTA"], ["Hakan Polat", "ORTA"], ["Ece Yurt", "GELISEN"], ["Onur Taş", "GELISEN"],
  ["Gizem Kurt", "GELISEN"], ["Kerem Ateş", "BASLANGIC"], ["Nil Güneş", "BASLANGIC"], ["Tolga Erdem", "BASLANGIC"],
  ["Pelin Aksoy", "YENI"], ["Rıza Kılıç", "YENI"],
];

function at(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysFromToday, hour, minute);
}
/** Bugüne göre gün farkı: friday(0) bu/gelecek cuma (bugün cumaysa bugün), friday(-1) ondan önceki cuma. */
function friday(weekOffset: number) {
  return ((5 - new Date().getDay() + 7) % 7) + weekOffset * 7;
}

async function playTournamentMatches(tournamentId: string, round: (r: string) => boolean, opts: { walkoverOnce?: boolean; limit?: number } = {}) {
  let walkover = opts.walkoverOnce ?? false;
  let played = 0;
  for (;;) {
    const ms = await db.match.findMany({
      where: { tournamentId, status: "PENDING", playerAId: { not: null }, playerBId: { not: null } },
      orderBy: [{ order: "asc" }],
    });
    const next = ms.filter((m) => round(m.round));
    if (next.length === 0 || (opts.limit !== undefined && played >= opts.limit)) return;
    for (const m of next) {
      if (opts.limit !== undefined && played >= opts.limit) return;
      const [a, b] = await Promise.all([
        db.salonPlayer.findUniqueOrThrow({ where: { id: m.playerAId! } }),
        db.salonPlayer.findUniqueOrThrow({ where: { id: m.playerBId! } }),
      ]);
      if (walkover && m.round === "GROUP") {
        await T.recordWalkover(m.id, a.id); // bir maç hükmen: rakip gelmedi
        walkover = false;
      } else {
        await T.recordMatchResult(m.id, scoreFor(a.elo, b.elo));
      }
      played++;
    }
  }
}

/** Geçmiş turnuvanın maç ve ELO tarihlerini turnuva gecesine taşır (geçmiş ekranları doğru görünsün). */
async function backdate(tournamentId: string, startsAt: Date) {
  const ms = await db.match.findMany({ where: { tournamentId, status: "DONE" }, orderBy: { order: "asc" } });
  for (const [i, m] of ms.entries()) {
    const when = new Date(startsAt.getTime() + (i + 1) * 6 * 60_000);
    await db.match.update({ where: { id: m.id }, data: { finishedAt: when } });
    await db.eloHistory.updateMany({ where: { matchId: m.id }, data: { createdAt: when } });
  }
}

async function main() {
  console.log("Prova veritabanı temizleniyor...");
  await db.salon.deleteMany();
  await db.player.deleteMany();

  const salon = await db.salon.create({
    data: {
      name: "Demo Masa Tenisi Salonu",
      tables: { create: [1, 2, 3, 4, 5, 6].map((number) => ({ number })) },
      priceRules: { create: [{ dayType: "WEEKDAY", hourlyRate: 200 }, { dayType: "WEEKEND", hourlyRate: 250 }] },
    },
  });
  const tables = await db.table.findMany({ where: { salonId: salon.id }, orderBy: { number: "asc" } });
  const ids: string[] = [];
  for (const [name, level] of PLAYERS) ids.push((await addSalonPlayer(salon.id, { name, level })).id);
  console.log(`${ids.length} oyuncu eklendi`);

  // 1) Bireysel maçlar: son iki hafta
  for (let i = 0; i < 12; i++) {
    const [x, y] = [between(0, ids.length - 1), between(0, ids.length - 1)];
    if (x === y) continue;
    const [a, b] = await Promise.all([db.salonPlayer.findUniqueOrThrow({ where: { id: ids[x] } }), db.salonPlayer.findUniqueOrThrow({ where: { id: ids[y] } })]);
    await saveIndividualMatch({ salonId: salon.id, playerAId: a.id, playerBId: b.id, sets: scoreFor(a.elo, b.elo), playedAt: at(-14 + i, 19), tableId: tables[i % 6].id });
  }
  console.log("Bireysel maçlar girildi");

  // 2) Geçen cuma: bitmiş, teselli turnuvalı, 16 kişilik turnuva (bir maç hükmen)
  const past = at(friday(-1), 20);
  const finished = await T.createTournament({
    salonId: salon.id, name: "Cuma Turnuvası", startsAt: past, endsAt: at(friday(-1), 23),
    entryFee: 300, prizes: ["Kupa + 1000 ₺", "Madalya", "Madalya"], tableIds: tables.slice(0, 4).map((t) => t.id), consolation: true,
  });
  await T.addParticipants(finished.id, ids.slice(0, 16));
  await T.startTournament(finished.id);
  await playTournamentMatches(finished.id, (r) => r === "GROUP", { walkoverOnce: true });
  await T.finishGroupStage(finished.id);
  for (const r of ["R16", "QF", "SF", "3RD", "F"]) await playTournamentMatches(finished.id, (x) => x === r);
  await backdate(finished.id, past);
  console.log("Geçen cumanın turnuvası oynandı (bitti)");

  // 3) Bugün: grup aşamasında, maçların yarısı girilmiş turnuva (sonuç girme ve TV denemesi için)
  const live = await T.createTournament({
    salonId: salon.id, name: "Hafta Sonu Kupası", startsAt: at(0, 0, 30), endsAt: at(0, 23, 30),
    entryFee: null, prizes: ["Kupa"], tableIds: tables.slice(4, 6).map((t) => t.id),
  });
  await T.addParticipants(live.id, ids.slice(2, 12));
  await T.startTournament(live.id);
  const total = await db.match.count({ where: { tournamentId: live.id } });
  await playTournamentMatches(live.id, (r) => r === "GROUP", { limit: Math.floor(total / 2) });
  console.log("Bugünkü turnuva grup aşamasında (maçların yarısı girildi)");

  // 4) Gelecek cuma: kaydı açık turnuva (oyuncu katılma denemesi için)
  const open = await T.createTournament({
    salonId: salon.id, name: "Gelecek Cuma Turnuvası", startsAt: at(friday(0), 20), endsAt: at(friday(0), 23),
    entryFee: 300, prizes: ["Kupa", "Madalya", "Madalya"], tableIds: tables.slice(0, 4).map((t) => t.id), consolation: true,
  });
  await T.addParticipants(open.id, ids.slice(4, 11));
  console.log("Gelecek cumanın turnuvası kayda açık (7 kişi kayıtlı)");

  // 5) Kiralamalar: önümüzdeki günler
  const rentals: [number, number, number, number, string][] = [
    [1, 14, 16, 0, "Ahmet Bey"], [1, 18, 20, 1, "Okul takımı"], [2, 10, 12, 2, "Sabah grubu"],
    [2, 19, 21, 0, "Selin Hanım"], [3, 17, 18, 3, "Murat"], [4, 12, 14, 1, "Şirket etkinliği"],
  ];
  for (const [day, from, to, tableIdx, customerName] of rentals) {
    try {
      await createRental({ tableId: tables[tableIdx].id, startsAt: at(day, from), endsAt: at(day, to), customerName });
    } catch (e) {
      console.log(`  kiralama atlandı (${customerName}): ${(e as Error).message}`);
    }
  }
  console.log("Kiralamalar eklendi");

  // 6) Oyuncu giriş bağlantıları (provada oyuncu gözüyle denemek için)
  console.log("\nOyuncu bağlantıları (her biri o oyuncu olarak giriş yapar):");
  for (const i of [0, 6, 16]) {
    const token = await createPlayerToken(ids[i]);
    console.log(`  ${PLAYERS[i][0].padEnd(14)} ${BASE}/oyuncu/giris/${token}`);
  }
  console.log(`\nSalon sahibi girişi: ${BASE}/giris (şifre .env içindeki ADMIN_PASSWORD)`);
  console.log(`Salon ekranı (bugünkü turnuva): ${BASE}/tv/${live.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
