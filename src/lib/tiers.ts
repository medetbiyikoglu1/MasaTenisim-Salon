/**
 * ELO kademeleri: her oyuncu ELO'suna göre bir kademede görünür. Sınırlar
 * başlangıç seviyeleriyle uyumludur; yeni oyuncu seçilen seviyenin kademesinde başlar.
 */
export type Tier = {
  key: string;
  name: string;
  /** Kademenin alt sınırı (dahil) */
  min: number;
  /** Raket ikonunun rengi ve rozet renkleri */
  color: string;
  badge: string;
  /** Üst kademelerde rakete eklenen yıldız sayısı */
  stars: number;
};

export const TIERS: Tier[] = [
  { key: "caylak", name: "Çaylak", min: 0, color: "#a1a1aa", badge: "bg-zinc-100 text-zinc-600", stars: 0 },
  { key: "bronz", name: "Bronz", min: 1150, color: "#b45309", badge: "bg-amber-100 text-amber-800", stars: 0 },
  { key: "gumus", name: "Gümüş", min: 1300, color: "#64748b", badge: "bg-slate-200 text-slate-700", stars: 0 },
  { key: "altin", name: "Altın", min: 1450, color: "#ca8a04", badge: "bg-yellow-100 text-yellow-800", stars: 1 },
  { key: "platin", name: "Platin", min: 1600, color: "#0d9488", badge: "bg-teal-100 text-teal-800", stars: 1 },
  { key: "elmas", name: "Elmas", min: 1750, color: "#2563eb", badge: "bg-blue-100 text-blue-800", stars: 2 },
  { key: "usta", name: "Usta", min: 1900, color: "#9333ea", badge: "bg-purple-100 text-purple-800", stars: 3 },
];

export function tierOf(elo: number): Tier {
  return [...TIERS].reverse().find((t) => elo >= t.min) ?? TIERS[0];
}

/** Kademenin üst sınırı (bir sonraki kademenin alt sınırı - 1); en üstte null. */
export function tierMax(tier: Tier): number | null {
  const next = TIERS[TIERS.indexOf(tier) + 1];
  return next ? next.min - 1 : null;
}
