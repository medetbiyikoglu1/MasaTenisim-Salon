"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { TournamentError, addParticipants, removeParticipant } from "@/lib/services/tournament";

/**
 * Oyuncu yalnızca kendini, yalnızca kayıt açık turnuvaya ekleyip çıkarabilir
 * (kayıt kontrolü servis tarafında). İşlemden sonra `geri` sayfasına döner.
 */
export async function changeEntry(formData: FormData) {
  const { playerId } = await getSession();
  if (!playerId) redirect("/oyuncu");
  const tournamentId = String(formData.get("tournamentId"));
  const join = formData.get("islem") === "katil";
  const back = String(formData.get("geri") ?? "/oyuncu");
  const to = (q: Record<string, string>) => `${back.startsWith("/") && !back.startsWith("//") ? back : "/oyuncu"}?${new URLSearchParams(q)}`;
  try {
    if (join) {
      await addParticipants(tournamentId, [playerId]);
    } else {
      const p = await db.participant.findUnique({ where: { tournamentId_salonPlayerId: { tournamentId, salonPlayerId: playerId } } });
      if (p) await removeParticipant(tournamentId, p.id);
    }
  } catch (e) {
    if (e instanceof TournamentError) redirect(to({ hata: e.message }));
    throw e;
  }
  revalidatePath("/oyuncu");
  revalidatePath(`/turnuvalar/${tournamentId}`);
  redirect(to({ tamam: join ? "Turnuvaya katıldın" : "Katılımın geri çekildi" }));
}
