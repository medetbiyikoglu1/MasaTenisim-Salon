/**
 * İmzalı çerez değerleri (HMAC-SHA256). Web Crypto kullanır; hem Node hem
 * middleware (edge) ortamında çalışır.
 */

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Sabit sürede karşılaştırma (zamanlama saldırısına karşı). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** "<payload>.<imza>" biçiminde imzalı değer üretir. */
export async function sign(payload: string, secret: string): Promise<string> {
  return `${payload}.${await hmac(secret, payload)}`;
}

/** İmza doğruysa payload'ı, değilse null döner. */
export async function verify(value: string | undefined, secret: string): Promise<string | null> {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = value.slice(0, i);
  return safeEqual(value.slice(i + 1), await hmac(secret, payload)) ? payload : null;
}

/** Oyuncu bağlantısı için tahmin edilemez rastgele anahtar. */
export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Veritabanında anahtarın kendisi değil, SHA-256 özeti tutulur. */
export async function sha256(value: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}
