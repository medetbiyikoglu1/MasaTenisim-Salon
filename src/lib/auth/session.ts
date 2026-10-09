import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { ADMIN_COOKIE, PLAYER_COOKIE } from "./access";
import { randomToken, safeEqual, sha256, sign, verify } from "./token";

const YEAR = 60 * 60 * 24 * 365;
const MONTH = 60 * 60 * 24 * 30;

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET tanımlı değil (.env)");
  return s;
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export type Session = { admin: boolean; playerId: string | null };

/** İstekteki çerezlerden kim olduğunu çözer. */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const secret = process.env.AUTH_SECRET;
  if (!secret) return { admin: false, playerId: null };
  const admin = (await verify(jar.get(ADMIN_COOKIE)?.value, secret)) === "admin";
  const player = await verify(jar.get(PLAYER_COOKIE)?.value, secret);
  return { admin, playerId: player?.startsWith("p:") ? player.slice(2) : null };
}

/** Şifre doğruysa salon sahibi oturumu açar. */
export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !safeEqual(password, expected)) return false;
  (await cookies()).set(ADMIN_COOKIE, await sign("admin", authSecret()), cookieOptions(MONTH));
  return true;
}

/** Kişisel bağlantıdaki anahtar geçerliyse oyuncu oturumu açar ve oyuncuyu döner. */
export async function loginPlayer(token: string) {
  const player = await db.salonPlayer.findUnique({ where: { accessTokenHash: await sha256(token) } });
  if (!player) return null;
  (await cookies()).set(PLAYER_COOKIE, await sign(`p:${player.id}`, authSecret()), cookieOptions(YEAR));
  return player;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(PLAYER_COOKIE);
}

/**
 * Oyuncu için yeni kişisel bağlantı anahtarı üretir. Eski bağlantı geçersiz olur.
 * Anahtarın yalnızca özeti saklanır; bağlantı bir kez gösterilir.
 */
export async function createPlayerToken(salonPlayerId: string): Promise<string> {
  const token = randomToken();
  await db.salonPlayer.update({ where: { id: salonPlayerId }, data: { accessTokenHash: await sha256(token) } });
  return token;
}

/**
 * Yönetici sunucu işlemlerinin başında çağrılır. Sunucu işlemleri sayfa
 * adresinden bağımsız çağrılabildiği için middleware'e ek olarak burada da kontrol edilir.
 */
export async function requireAdmin() {
  if (!(await getSession()).admin) redirect("/giris");
}
