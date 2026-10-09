import { NextResponse } from "next/server";
import { logout } from "@/lib/auth/session";

export async function GET(req: Request) {
  await logout();
  return NextResponse.redirect(new URL("/giris", req.url), 303);
}
