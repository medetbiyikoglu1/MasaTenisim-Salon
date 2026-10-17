/**
 * Duman testi: çalışan provada (npm run prova) her rol için ana sayfaları açar,
 * beklenen durum kodunu, yönlendirmeyi ve içeriği kontrol eder.
 * Kullanım: npm run prova:kontrol
 */
import { db } from "../src/lib/db";
import { ADMIN_COOKIE, PLAYER_COOKIE } from "../src/lib/auth/access";
import { sign } from "../src/lib/auth/token";

const BASE = process.env.PROVA_URL ?? "http://localhost:3002";
const SECRET = process.env.AUTH_SECRET!;

type Check = { who: "misafir" | "oyuncu" | "yönetici"; path: string; expect: number | string; contains?: string };

async function main() {
  const salon = await db.salon.findFirstOrThrow();
  const [live, finished, open, player, table] = await Promise.all([
    db.tournament.findFirstOrThrow({ where: { status: "GROUPS" } }),
    db.tournament.findFirstOrThrow({ where: { status: "FINISHED" } }),
    db.tournament.findFirstOrThrow({ where: { status: "DRAFT" } }),
    db.salonPlayer.findFirstOrThrow({ where: { matchesCount: { gt: 0 } }, include: { player: true } }),
    db.table.findFirstOrThrow(),
  ]);
  const match = await db.match.findFirstOrThrow({ where: { tournamentId: live.id, status: "PENDING" } });
  const cookie = {
    misafir: "",
    oyuncu: `${PLAYER_COOKIE}=${await sign(`p:${player.id}`, SECRET)}`,
    yönetici: `${ADMIN_COOKIE}=${await sign("admin", SECRET)}`,
  };

  const checks: Check[] = [
    // Herkese açık
    { who: "misafir", path: "/giris", expect: 200, contains: "Salon sahibi girişi" },
    { who: "misafir", path: `/tv/${live.id}`, expect: 200, contains: live.name },
    { who: "misafir", path: "/oyuncu", expect: 200, contains: "kişisel bağlantını" },
    { who: "misafir", path: "/oyuncu/giris/gecersiz-anahtar", expect: "/oyuncu?hata=gecersiz" },
    { who: "misafir", path: "/", expect: "/turnuvalar" },
    { who: "misafir", path: "/turnuvalar", expect: 200, contains: live.name },
    { who: "misafir", path: `/turnuvalar/${open.id}`, expect: 200, contains: "Üye girişi" },
    { who: "misafir", path: "/turnuvalar/yeni", expect: "/giris" },
    // Salon sahibi
    { who: "yönetici", path: "/", expect: 200, contains: salon.name },
    { who: "yönetici", path: "/turnuvalar", expect: 200, contains: "Yeni turnuva" },
    { who: "yönetici", path: "/turnuvalar/yeni", expect: 200, contains: "Teselli turnuvası olsun" },
    { who: "yönetici", path: `/turnuvalar/${live.id}`, expect: 200, contains: "Grup aşamasını bitir" },
    { who: "yönetici", path: `/turnuvalar/${finished.id}`, expect: 200, contains: "Teselli turnuvası" },
    { who: "yönetici", path: `/turnuvalar/${open.id}`, expect: 200, contains: "Grupları kur" },
    { who: "yönetici", path: `/turnuvalar/${live.id}/mac/${match.id}`, expect: 200, contains: "Hükmen" },
    { who: "yönetici", path: "/maclar", expect: 200, contains: "Bireysel maçlar" },
    { who: "yönetici", path: "/oyuncular", expect: 200, contains: "Kademeler" },
    { who: "yönetici", path: `/oyuncular/${player.id}`, expect: 200, contains: "Oyuncu bağlantısı" },
    { who: "yönetici", path: "/masalar", expect: 200, contains: "haftalık doluluk" },
    { who: "yönetici", path: `/masalar/${table.id}`, expect: 200, contains: "bu hafta doluluk" },
    // Oyuncu
    { who: "oyuncu", path: "/oyuncu", expect: 200, contains: player.player.name },
    { who: "oyuncu", path: "/oyuncular", expect: 200, contains: "Puan durumu" },
    { who: "oyuncu", path: `/turnuvalar/${open.id}`, expect: 200, contains: "Katılımcılar" },
    { who: "oyuncu", path: `/turnuvalar/${finished.id}`, expect: 200, contains: "Kazananlar" },
    { who: "oyuncu", path: "/", expect: "/oyuncu" },
    { who: "oyuncu", path: "/turnuvalar/yeni", expect: "/oyuncu" },
    { who: "oyuncu", path: `/turnuvalar/${live.id}/mac/${match.id}`, expect: "/oyuncu" },
    { who: "oyuncu", path: "/masalar", expect: "/oyuncu" },
    { who: "oyuncu", path: "/maclar", expect: "/oyuncu" },
  ];

  let failed = 0;
  for (const c of checks) {
    const res = await fetch(BASE + c.path, { headers: { cookie: cookie[c.who] }, redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    const body = res.status === 200 ? await res.text() : "";
    let ok: boolean;
    let got: string;
    if (typeof c.expect === "number") {
      ok = res.status === c.expect && (!c.contains || body.includes(c.contains));
      got = `${res.status}${c.contains && res.status === 200 && !body.includes(c.contains) ? ` ("${c.contains}" yok)` : ""}`;
    } else {
      const target = new URL(location || "/", BASE);
      ok = res.status >= 300 && res.status < 400 && (target.pathname + target.search).startsWith(c.expect);
      got = `${res.status} -> ${location}`;
    }
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${c.who.padEnd(8)} ${c.path.padEnd(40)} ${ok ? "" : `beklenen ${c.expect}, gelen ${got}`}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} kontrol geçti`);
  if (failed) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
