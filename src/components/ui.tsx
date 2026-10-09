import Link from "next/link";
import type { SetScore } from "@/lib/tournament";

const AVATAR_COLORS = [
  "bg-court-700",
  "bg-ball-500",
  "bg-sky-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-teal-600",
  "bg-indigo-600",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toLocaleUpperCase("tr-TR");
}

function colorOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Baş harfli, isme göre sabit renkli yuvarlak avatar. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-11 w-11 text-sm" }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${cls} ${colorOf(name)}`}>
      {initials(name)}
    </span>
  );
}

/** ELO değişim rozeti: +12 yeşil, -8 kırmızı. */
export function EloDelta({ delta }: { delta?: number | null }) {
  if (delta === undefined || delta === null) return null;
  const cls = delta > 0 ? "bg-emerald-100 text-emerald-700" : delta < 0 ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-600";
  return <span className={`rounded px-1 text-[11px] font-semibold tabular-nums ${cls}`}>{delta > 0 ? `+${delta}` : delta}</span>;
}

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Kayıt açık", "bg-ball-100 text-ball-600"],
  GROUPS: ["Grup aşaması", "bg-sky-100 text-sky-800"],
  KNOCKOUT: ["Eleme", "bg-violet-100 text-violet-800"],
  FINISHED: ["Bitti", "bg-court-100 text-court-800"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-zinc-100 text-zinc-700"];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

type Side = { id: string; name: string; delta?: number | null } | null;

export type ScoreboardProps = {
  a: Side;
  b: Side;
  sets: SetScore[] | null;
  winnerId: string | null;
  done: boolean;
  /** Boş taraf için gösterilecek metin ("bay" veya "?") */
  emptyLabel?: string;
  href?: string;
  /** Sağda gösterilen çağrı ("Sonuç gir") */
  action?: string;
  /** Fareyle üzerine gelince ipucu */
  title?: string;
  /** Hükmen sonuç: set yok, kazanan "hükmen", diğeri "gelmedi" */
  walkover?: boolean;
};

/**
 * Skor tabelası görünümünde maç: her oyuncu bir satır, setler sütun,
 * en sağda alınan set sayısı. Kazanan satır vurgulu.
 */
export function Scoreboard({ a, b, sets, winnerId, done, emptyLabel = "?", href, action, title, walkover = false }: ScoreboardProps) {
  const list = sets ?? [];
  const won = [0, 0];
  for (const [x, y] of list) won[x > y ? 0 : 1]++;
  const row = (side: Side, i: 0 | 1) => {
    const winner = done && !!side && side.id === winnerId;
    const loser = done && !!side && !winner;
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${winner ? "bg-court-50" : ""}`}>
        {side ? <Avatar name={side.name} size="sm" /> : <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-zinc-300" />}
        <span className={`min-w-0 flex-1 truncate text-sm ${winner ? "font-semibold text-zinc-900" : loser ? "text-zinc-500" : side ? "text-zinc-800" : "text-zinc-400 italic"}`}>
          {side?.name ?? emptyLabel}
        </span>
        {side && <span className="hidden @[15rem]:inline"><EloDelta delta={side.delta} /></span>}
        <span className="hidden gap-0.5 @[19rem]:flex">
          {list.map((s, k) => (
            <span
              key={k}
              className={`w-6 text-center text-xs tabular-nums ${s[i] > s[1 - i] ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
              {s[i]}
            </span>
          ))}
        </span>
        {done && walkover && side && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${winner ? "bg-court-800 text-white" : "bg-red-100 text-red-700"}`}
          >
            {winner ? "hükmen" : "gelmedi"}
          </span>
        )}
        {done && list.length > 0 && (
          <span className={`flex h-6 w-6 items-center justify-center rounded text-sm font-bold tabular-nums ${winner ? "bg-court-800 text-white" : "bg-zinc-100 text-zinc-500"}`}>
            {won[i]}
          </span>
        )}
      </div>
    );
  };
  const body = (
    <div className="@container flex">
      <div className="min-w-0 flex-1">
        {row(a, 0)}
        <div className="border-t border-zinc-100" />
        {row(b, 1)}
      </div>
      {action && (
        <span className="flex items-center border-l border-zinc-100 bg-ball-50 px-2.5 text-xs font-semibold text-ball-600">
          {action}
        </span>
      )}
    </div>
  );
  const cls = "block overflow-hidden rounded-lg border border-zinc-200 bg-white";
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} title={title} className={`${cls} transition hover:border-court-600 hover:shadow-md ${!done ? "border-dashed" : ""}`}>
      {body}
    </Link>
  );
}
