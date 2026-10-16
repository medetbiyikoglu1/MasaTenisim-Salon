"use server";

import { headers } from "next/headers";
import { publicOrigin } from "@/lib/auth/public-url";
import { createPlayerToken, requireAdmin } from "@/lib/auth/session";

export type LinkState = { url: string } | null;

/** Oyuncu için yeni kişisel bağlantı oluşturur (eskisi geçersiz olur) ve tam adresini döner. */
export async function createPlayerLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const token = await createPlayerToken(String(formData.get("playerId")));
  return { url: `${publicOrigin(await headers())}/oyuncu/giris/${token}` };
}
