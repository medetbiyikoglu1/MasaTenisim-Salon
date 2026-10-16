/**
 * İsteğin dışarıdan görünen adresi. Tünel ya da ters vekil (Cloudflare, Nginx)
 * arkasında `req.url` sunucunun iç adresini (ör. localhost:3002) verir; kullanıcıyı
 * oraya yönlendirmemek için host ve x-forwarded-* başlıkları kullanılır.
 */
export function publicOrigin(headers: Headers, fallback?: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return fallback ? new URL(fallback).origin : "http://localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (fallback ? new URL(fallback).protocol.replace(":", "") : "http");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

export function publicUrl(req: Request, path: string): URL {
  return new URL(path, publicOrigin(req.headers, req.url));
}
