import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/auth/public-url";
import { loginPlayer } from "@/lib/auth/session";

/** Kişisel bağlantı: geçerliyse oyuncu oturumu açılır ve oyuncu sayfasına gidilir. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const player = await loginPlayer(token);
  return NextResponse.redirect(publicUrl(req, player ? "/oyuncu" : "/oyuncu?hata=gecersiz"), 303);
}
