import { NextResponse } from "next/server";
import { loginPlayer } from "@/lib/auth/session";

/** Kişisel bağlantı: geçerliyse oyuncu oturumu açılır ve oyuncu sayfasına gidilir. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const player = await loginPlayer(token);
  const url = new URL(player ? "/oyuncu" : "/oyuncu?hata=gecersiz", req.url);
  return NextResponse.redirect(url, 303);
}
