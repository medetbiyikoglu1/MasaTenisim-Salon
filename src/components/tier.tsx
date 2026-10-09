import type { Level } from "@/lib/services/player";
import { STARTING_ELO } from "@/lib/tournament";
import { tierOf, type Tier } from "@/lib/tiers";

/**
 * Kademe ikonu: kademe renginde bir masa tenisi raketi. Altın ve üstünde
 * rakette yıldızlar, en üst kademede ayrıca taç bulunur.
 */
export function TierIcon({ tier, size = 20 }: { tier: Tier; size?: number }) {
  const starPos = { 1: [[12, 9.5]], 2: [[9, 9.5], [15, 9.5]], 3: [[12, 7.6], [8.6, 11.8], [15.4, 11.8]] }[tier.stars] ?? [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={`${tier.name} kademesi`} className="shrink-0">
      <title>{tier.name}</title>
      {/* Sap: kafaya doğru genişleyen ahşap tutamak */}
      <path d="M9.3 15.2 H14.7 L13.9 22.6 a1.1 1.1 0 0 1 -1.1 1 H11.2 a1.1 1.1 0 0 1 -1.1 -1 Z" fill="#a0642c" />
      <path d="M11.5 16 V23" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Kafa */}
      <circle cx="12" cy="9.5" r="8" fill={tier.color} />
      <circle cx="12" cy="9.5" r="8" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      <ellipse cx="9.2" cy="6.3" rx="3" ry="1.8" fill="rgba(255,255,255,0.28)" transform="rotate(-30 9.2 6.3)" />
      {starPos.map(([x, y], i) => (
        <path
          key={i}
          transform={`translate(${x} ${y}) scale(${tier.stars === 3 ? 0.55 : 0.65})`}
          d="M0,-4 L1.2,-1.3 4,-1.2 1.8,0.7 2.5,3.6 0,2 -2.5,3.6 -1.8,0.7 -4,-1.2 -1.2,-1.3 Z"
          fill="#fff"
        />
      ))}
      {tier.key === "usta" && <path d="M7.5 1.6 L9.4 3.4 L12 0.6 L14.6 3.4 L16.5 1.6 L16 4.6 H8 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.5" />}
    </svg>
  );
}

/** ELO'ya göre kademe rozeti; `compact` ise yalnızca ikon. */
export function TierBadge({ elo, compact = false }: { elo: number; compact?: boolean }) {
  const tier = tierOf(elo);
  if (compact) return <TierIcon tier={tier} size={18} />;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[11px] font-semibold ${tier.badge}`}>
      <TierIcon tier={tier} size={16} /> {tier.name}
    </span>
  );
}

/** Oyuncu eklerken başlangıç seviyesi seçimi: her seviye kendi kademe ikonu ve ELO'suyla. */
export function LevelPicker({ levels, name = "level", defaultValue = "ORTA" }: { levels: { value: Level; label: string; hint: string }[]; name?: string; defaultValue?: Level }) {
  return (
    <fieldset className="w-full">
      <legend className="label">Başlangıç seviyesi</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {levels.map((l) => {
          const elo = STARTING_ELO[l.value];
          return (
            <label
              key={l.value}
              title={l.hint}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-zinc-200 px-2 py-2 text-center transition has-checked:border-court-600 has-checked:bg-court-50 has-checked:ring-1 has-checked:ring-court-600 hover:border-zinc-300"
            >
              <input type="radio" name={name} value={l.value} defaultChecked={l.value === defaultValue} className="sr-only" />
              <TierIcon tier={tierOf(elo)} size={26} />
              <span className="text-xs font-semibold leading-tight">{l.label}</span>
              <span className="text-[10px] tabular-nums text-zinc-500">{elo}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
