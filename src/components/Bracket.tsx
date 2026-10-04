import type { ReactNode } from "react";

export type BracketColumn = { key: string; label: string; matches: { key: string; node: ReactNode }[] };


/**
 * Eleme ağacı: turlar soldan sağa sütunlar. Her sütundaki maç kutusu eşit
 * yükseklikte paylara bölünür; bir sonraki turda maç sayısı yarıya indiği için
 * her maç kendi iki ön maçının tam ortasına denk gelir. Çizgiler kutuların
 * kenar boşluklarına çizilir.
 */
export function Bracket({ columns, champion, dark = false }: { columns: BracketColumn[]; champion: ReactNode; dark?: boolean }) {
  const LINE = dark ? "border-white/25" : "border-zinc-300";
  const labelCls = dark ? "text-court-100/70" : "text-zinc-500";
  const slots = Math.max(1, columns[0]?.matches.length ?? 1);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex">
        {columns.map((col, ci) => {
          const first = ci === 0;
          const last = ci === columns.length - 1;
          return (
            <div key={col.key} className="flex min-w-64 flex-1 flex-col">
              <h3 className={`mb-2 px-4 text-xs font-semibold tracking-wider uppercase ${labelCls}`}>{col.label}</h3>
              <div className="flex flex-1 flex-col" style={{ minHeight: `${slots * 5.5}rem` }}>
                {col.matches.map((m, mi) => (
                  <div key={m.key} className="relative flex flex-1 items-center px-4 py-2">
                    {/* Soldan gelen çizgi */}
                    {!first && <span className={`absolute top-1/2 left-0 w-4 border-t-2 ${LINE}`} />}
                    {/* Sağa giden çizgi ve eşini bağlayan dikey çizgi */}
                    <span className={`absolute top-1/2 right-0 w-4 border-t-2 ${LINE}`} />
                    {!last && (
                      <span
                        className={`absolute right-0 h-1/2 border-r-2 ${LINE} ${mi % 2 === 0 ? "top-1/2" : "bottom-1/2"}`}
                      />
                    )}
                    <div className="w-full">{m.node}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex w-48 shrink-0 flex-col">
          <h3 className="mb-2 px-4 text-xs font-semibold tracking-wider text-ball-600 uppercase">Şampiyon</h3>
          <div className="relative flex flex-1 items-center px-4" style={{ minHeight: `${slots * 5.5}rem` }}>
            <span className={`absolute top-1/2 left-0 w-4 border-t-2 ${LINE}`} />
            {champion}
          </div>
        </div>
      </div>
    </div>
  );
}
