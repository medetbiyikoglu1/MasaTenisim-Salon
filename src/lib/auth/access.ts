/** Kim hangi sayfaya erişebilir? Middleware ve testler bu saf kuralı kullanır. */

export type Role = "admin" | "player" | "guest";
export type Access = "allow" | "login" | "player-home";

export const ADMIN_COOKIE = "salon_admin";
export const PLAYER_COOKIE = "salon_oyuncu";

/** Herkese açık: giriş sayfaları ve salon ekranı. */
const PUBLIC = [/^\/giris$/, /^\/cikis$/, /^\/oyuncu\/giris\/[^/]+$/, /^\/tv\/[^/]+$/];

/** Oyuncunun yalnızca görüntüleyebildiği sayfalar (GET). */
const PLAYER_READ = [/^\/turnuvalar$/, /^\/turnuvalar\/(?!yeni$)[^/]+$/, /^\/oyuncular$/, /^\/oyuncular\/[^/]+$/];

/**
 * Oyuncunun turnuva sayfasından katıl/çekil gönderebilmesi için. Yönetici
 * işlemleri ayrıca kendi içinde salon sahibi kontrolü yapar (requireAdmin).
 */
const PLAYER_POST = [/^\/turnuvalar\/(?!yeni$)[^/]+$/];

/** Oyuncunun kendi alanı: görüntüleme ve kendi işlemleri (katıl/çekil). */
const PLAYER_AREA = /^\/oyuncu(\/.*)?$/;

export function accessFor(path: string, method: string, role: Role): Access {
  if (PUBLIC.some((r) => r.test(path))) return "allow";
  if (role === "admin") return "allow";
  if (role === "player") {
    if (PLAYER_AREA.test(path)) return "allow";
    if (method === "GET" && PLAYER_READ.some((r) => r.test(path))) return "allow";
    if (method === "POST" && PLAYER_POST.some((r) => r.test(path))) return "allow";
    return "player-home";
  }
  // Girişsiz oyuncu kendi sayfasında "bağlantını salon sahibinden iste" açıklamasını görür
  if (path === "/oyuncu" && method === "GET") return "allow";
  return "login";
}
