"use client";

import { useActionState, useState } from "react";
import type { LinkState } from "@/app/oyuncular/[id]/actions";

type Props = {
  playerId: string;
  playerName: string;
  hasLink: boolean;
  action: (prev: LinkState, formData: FormData) => Promise<LinkState>;
};

/** Salon sahibinin oyuncuya kişisel giriş bağlantısı oluşturup paylaştığı kart. */
export function PlayerLinkCard({ playerId, playerName, hasLink, action }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  const message = state ? `Merhaba ${playerName}, masa tenisi salonundaki oyuncu sayfan: ${state.url}` : "";

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="mb-1">Oyuncu bağlantısı</h2>
        <p className="text-sm text-zinc-600">
          Oyuncu bu bağlantıyı bir kez açınca kendi sayfasına girer: maç geçmişini, puan durumunu görür ve kayıt açık
          turnuvalara katılabilir. Turnuva oluşturamaz, sonuç giremez.
        </p>
      </div>
      {state ? (
        <div className="space-y-2">
          <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} className="input w-full font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.url);
                setCopied(true);
              }}
              className="btn btn-ghost"
            >
              {copied ? "✓ Kopyalandı" : "Kopyala"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn bg-[#25d366] hover:bg-[#1ebe5b]">
              WhatsApp&apos;ta gönder
            </a>
          </div>
          <p className="text-xs text-zinc-500">Bağlantı yalnızca şimdi gösteriliyor; kaybolursa yenisini oluştur.</p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="playerId" value={playerId} />
          <button disabled={pending} className="btn btn-accent disabled:opacity-50">
            {hasLink ? "Yeni bağlantı oluştur" : "Bağlantı oluştur"}
          </button>
          {hasLink && <span className="text-xs text-zinc-500">Bu oyuncunun bağlantısı var; yenisi oluşturulursa eskisi çalışmaz.</span>}
        </form>
      )}
    </section>
  );
}
