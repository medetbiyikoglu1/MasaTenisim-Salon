import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/auth/public-url";
import { logout } from "@/lib/auth/session";

export async function GET(req: Request) {
  await logout();
  return NextResponse.redirect(publicUrl(req, "/giris"), 303);
}
