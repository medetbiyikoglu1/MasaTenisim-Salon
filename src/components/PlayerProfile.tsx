import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TierBadge } from "@/components/tier";
import { Avatar, EloDelta } from "@/components/ui";
import { db } from "@/lib/db";
import { PROVISIONAL_MATCHES, knockoutLabel, setsWon, type SetScore } from "@/lib/tournament";

type Props = {
  id: string;
  /** Başlığın üstünde küçük karşılama ("Merhaba") */
  greeting?: string;
  /** Verilirse maç geçmişinin yalnızca son N maçı gösterilir */
  recentLimit?: number;
  /** İstatistikler ile maç geçmişi arasına eklenecek bölümler */
  children?: ReactNode;
};

/** Oyuncu özeti: başlık, istatistikler, ELO grafiği ve maç geçmişi. Salon sahibi ve oyuncu ekranı ortak kullanır. */
export async function PlayerProfile({ id, greeting, recentLimit, children }: Props) {
  const sp = await db.salonPlayer.findUnique({
    where: { id },
    include: {
      player: true,
      eloHistory: {
        orderBy: { createdAt: "asc" },
        include: { match: { include: { tournament: true, group: true, eloHistory: true } } },
      },
    },
  });
  if (!sp) notFound();

  const opponentIds = sp.eloHistory.map((h) => (h.match.playerAId === id ? h.match.playerBId : h.match.playerAId)).filter((x): x is string => !!x);
  const opponents = new Map(
    (await db.salonPlayer.findMany({ where: { id: { in: opponentIds } }, include: { player: true } })).map((o) => [o.id, o]),
  );
  const [rank, total] = await Promise.all([
    db.salonPlayer.count({ where: { salonId: sp.salonId, elo: { gt: sp.elo } } }),
    db.salonPlayer.count({ where: { salonId: sp.salonId } }),
  ]);

  const history = sp.eloHistory.map((h) => {
    const m = h.match;
    const isA = m.playerAId === id;
    const oppId = isA ? m.playerBId : m.playerAId;
    // Setleri bu oyuncunun gözünden çevir
    const sets = ((m.sets as SetScore[] | null) ?? []).map(([a, b]) => (isA ? [a, b] : [b, a]) as SetScore);
    const [mine, theirs] = setsWon(sets);
    return {
      id: h.id,
      date: m.finishedAt ?? h.createdAt,
      tournament: m.tournament,
      stage: m.group ? `Grup ${m.group.name}` : m.tournament ? knockoutLabel(m.round, m.bracket) : null,
      opponent: oppId ? opponents.get(oppId) : undefined,
      oppDelta: m.eloHistory.find((x) => x.salonPlayerId === oppId)?.delta,
      won: m.winnerId === id,
      sets,
      score: `${mine}-${theirs}`,
      before: h.before,
      after: h.after,
      delta: h.delta,
    };
  });
  const wins = history.filter((h) => h.won).length;
  const losses = history.length - wins;
  const peak = Math.max(sp.elo, ...history.map((h) => h.after));
  const setsFor = history.reduce((n, h) => n + h.sets.filter(([a, b]) => a > b).length, 0);
  const setsAgainst = history.reduce((n, h) => n + h.sets.filter(([a, b]) => b > a).length, 0);
  const winPct = history.length ? Math.round((wins / history.length) * 100) : 0;
  const recent = [...history].reverse();

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-court-800 px-6 py-6 text-white shadow-md">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white/10" />
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/10" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar name={sp.player.name} size="lg" />
          <div className="flex-1">
            {greeting && <p className="text-sm font-medium text-court-100">{greeting}</p>}
            <h1 className="mb-0 flex flex-wrap items-center gap-3 text-white">
              {sp.player.name} <TierBadge elo={sp.elo} />
            </h1>
            <p className="text-sm text-court-100">
              Sıralamada {rank + 1}. / {total}
              {sp.matchesCount < PROVISIONAL_MATCHES && " · ELO henüz oturmadı"}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl font-bold tabular-nums">{sp.elo}</div>
            <div className="text-xs tracking-wider text-court-100 uppercase">ELO</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Maç" value={history.length} />
        <Stat label="Galibiyet - Mağlubiyet" value={`${wins}-${losses}`} />
        <Stat label="Galibiyet yüzdesi" value={`%${winPct}`} tone={winPct >= 50 ? "text-emerald-700" : "text-red-600"} />
        <Stat label="Set averajı" value={`${setsFor}-${setsAgainst}`} />
        <Stat label="En yüksek ELO" value={peak} />
      </div>

      {history.length > 0 && (
        <section className="card">
          <h2>ELO değişimi</h2>
          <EloChart points={[history[0].before, ...history.map((h) => h.after)]} />
        </section>
      )}

      {children}

      <section className="card">
        <h2>{recentLimit ? "Son maçlar" : "Maç geçmişi"}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-600">Henüz sonuçlanmış maçı yok.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(recentLimit ? recent.slice(0, recentLimit) : recent).map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3 sm:gap-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold text-white ${h.won ? "bg-court-700" : "bg-red-500"}`}
                  title={h.won ? "Galibiyet" : "Mağlubiyet"}
                >
                  {h.won ? "G" : "M"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">vs</span>
                    {h.opponent ? (
                      <Link href={`/oyuncular/${h.opponent.id}`} className="flex min-w-0 items-center gap-2 font-medium hover:underline">
                        <Avatar name={h.opponent.player.name} size="sm" />
                        <span className="truncate">{h.opponent.player.name}</span>
                      </Link>
                    ) : (
                      <span className="text-zinc-400">?</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {h.tournament ? (
                      <>
                        <Link href={`/turnuvalar/${h.tournament.id}`} className="hover:underline">{h.tournament.name}</Link> · {h.stage}
                      </>
                    ) : (
                      <span className="rounded bg-sky-100 px-1.5 font-medium text-sky-800">Bireysel maç</span>
                    )}{" "}
                    ·{" "}
                    {h.date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="mt-1.5 sm:hidden"><SetChips sets={h.sets} /></div>
                </div>
                <div className="hidden sm:block"><SetChips sets={h.sets} /></div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-display text-2xl leading-none font-bold tabular-nums">{h.score}</span>
                  <span className="flex items-center gap-1.5 text-xs tabular-nums">
                    <span className="text-zinc-400">{h.after}</span>
                    <EloDelta delta={h.delta} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SetChips({ sets }: { sets: SetScore[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sets.map(([a, b], i) => (
        <span
          key={i}
          className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${a > b ? "bg-court-50 font-semibold text-court-800" : "bg-zinc-100 text-zinc-500"}`}
        >
          {a}-{b}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = "text-court-800" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
      <div className={`font-display text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

/** Maç maç ELO çizgisi (başlangıç + her maç sonrası). */
function EloChart({ points }: { points: number[] }) {
  const W = 800;
  const H = 200;
  const pad = 24;
  const min = Math.min(...points) - 10;
  const max = Math.max(...points) + 10;
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - pad - ((v - min) * (H - pad * 2)) / Math.max(1, max - min);
  const path = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ELO değişim grafiği">
      {[min + 10, max - 10].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} className="stroke-zinc-200" strokeDasharray="4 4" />
          <text x={W - pad} y={y(v) - 4} textAnchor="end" className="fill-zinc-400 text-[11px]">{v}</text>
        </g>
      ))}
      <path d={area} className="fill-court-100/60" />
      <path d={path} fill="none" className="stroke-court-700" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={3.5}
          className={i === 0 ? "fill-zinc-400" : v >= points[i - 1] ? "fill-court-700" : "fill-red-500"}
        />
      ))}
    </svg>
  );
}
