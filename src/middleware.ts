import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, PLAYER_COOKIE, accessFor, type Role } from "@/lib/auth/access";
import { verify } from "@/lib/auth/token";

/** Her istekte rolü çözüp erişim kuralını uygular: salon sahibi, oyuncu ya da misafir. */
export async function middleware(req: NextRequest) {
  // Sunucu işlemleri (form gönderimleri) burada yönlendirilmez: düz bir 303 yanıtı
  // istemcide "unexpected response" hatası verir. Her yönetici işlemi kendi içinde
  // requireAdmin ile korunur ve yetkisiz kullanıcıyı giriş sayfasına düzgünce yollar;
  // oyuncu işlemi de oturumu kendisi kontrol eder.
  if (req.method === "POST" && req.headers.has("next-action")) return NextResponse.next();

  const secret = process.env.AUTH_SECRET ?? "";
  let role: Role = "guest";
  if (secret && (await verify(req.cookies.get(ADMIN_COOKIE)?.value, secret)) === "admin") role = "admin";
  else if (secret && (await verify(req.cookies.get(PLAYER_COOKIE)?.value, secret))?.startsWith("p:")) role = "player";

  const access = accessFor(req.nextUrl.pathname, req.method, role);
  if (access === "allow") return NextResponse.next();
  const target = access === "player-home" ? "/oyuncu" : "/giris";
  const url = new URL(target, req.url);
  if (access === "login" && req.method === "GET") url.searchParams.set("sonra", req.nextUrl.pathname);
  return NextResponse.redirect(url, 303);
}

export const config = {
  // Next.js'in kendi dosyaları ve statik dosyalar hariç her istek
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
