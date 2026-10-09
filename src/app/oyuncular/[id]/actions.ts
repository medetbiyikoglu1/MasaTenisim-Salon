"use server";

import { headers } from "next/headers";
import { createPlayerToken, requireAdmin } from "@/lib/auth/session";

export type LinkState = { url: string } | null;

/** Oyuncu için yeni kişisel bağlantı oluşturur (eskisi geçersiz olur) ve tam adresini döner. */
export async function createPlayerLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const token = await createPlayerToken(String(formData.get("playerId")));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { url: `${proto}://${host}/oyuncu/giris/${token}` };
}
