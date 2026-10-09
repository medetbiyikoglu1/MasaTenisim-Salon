import Link from "next/link";
import { PlayerLinkCard } from "@/components/PlayerLinkCard";
import { PlayerProfile } from "@/components/PlayerProfile";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createPlayerLink } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin } = await getSession();
  const sp = admin ? await db.salonPlayer.findUnique({ where: { id }, include: { player: true } }) : null;
  return (
    <div className="space-y-6">
      <Link href="/oyuncular" className="text-sm text-zinc-500 hover:text-zinc-900">← {admin ? "ELO sıralaması" : "Puan durumu"}</Link>
      <PlayerProfile id={id}>
        {sp && <PlayerLinkCard playerId={sp.id} playerName={sp.player.name} hasLink={!!sp.accessTokenHash} action={createPlayerLink} />}
      </PlayerProfile>
    </div>
  );
}
