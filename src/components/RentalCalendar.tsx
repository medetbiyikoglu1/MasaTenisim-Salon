"use client";

import { useState } from "react";
import type { CalendarDay, Slot } from "@/lib/services/rental";

type Props = {
  tableId: string;
  week: string;
  days: CalendarDay[];
  rates: { WEEKDAY?: number; WEEKEND?: number };
  today: string;
  create: (formData: FormData) => Promise<void>;
  cancel: (formData: FormData) => Promise<void>;
};

type Selection = { day: number; start: number; end: number };

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const addMinutes = (hhmm: string, add: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + add;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const dateOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Haftalık masa takvimi. Boş bir dilime tıklamak başlangıcı, aynı günde
 * sonraki bir dilime tıklamak bitişi seçer. Kiralanmış dilime tıklayınca
 * kiralamanın ayrıntısı ve iptal butonu çıkar.
 */
export function RentalCalendar({ tableId, week, days, rates, today, create, cancel }: Props) {
  const [sel, setSel] = useState<Selection | null>(null);
  const [rental, setRental] = useState<Extract<Slot, { kind: "rental" }> & { day: number } | null>(null);
  const times = days[0]?.slots.map((s) => s.time) ?? [];

  const click = (day: number, idx: number) => {
    const slot = days[day].slots[idx];
    if (slot.kind === "rental") {
      setSel(null);
      setRental({ ...slot, day });
      return;
    }
    if (slot.kind !== "free") return;
    setRental(null);
    if (sel && sel.day === day && idx > sel.start && idx !== sel.end) {
      const between = days[day].slots.slice(sel.start, idx + 1);
      if (between.every((s) => s.kind === "free")) {
        setSel({ ...sel, end: idx });
        return;
      }
    }
    setSel(sel && sel.day === day && sel.start === idx && sel.end === idx ? null : { day, start: idx, end: idx });
  };

  const selected = (day: number, idx: number) => !!sel && sel.day === day && idx >= sel.start && idx <= sel.end;
  const selDate = sel ? dateOf(days[sel.day].date) : null;
  const selStart = sel ? times[sel.start] : "";
  const selEnd = sel ? addMinutes(times[sel.end], 30) : "";
  const minutes = sel ? (sel.end - sel.start + 1) * 30 : 0;
  const rate = selDate ? (selDate.getDay() === 0 || selDate.getDay() === 6 ? rates.WEEKEND : rates.WEEKDAY) : undefined;
  const price = rate !== undefined ? (rate * minutes) / 60 : null;
  const longDate = (d: Date) => d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="grid min-w-[680px] grid-cols-[3.5rem_repeat(7,1fr)]">
          <div className="sticky left-0 z-[1] border-b border-zinc-200 bg-white" />
          {days.map((d, i) => {
            const date = dateOf(d.date);
            const isToday = d.date === today;
            return (
              <div key={d.date} className={`border-b border-l border-zinc-200 px-1 py-2 text-center ${isToday ? "bg-court-50" : ""}`}>
                <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">{DAY_NAMES[i]}</div>
                <div className={`font-display text-xl font-bold ${isToday ? "text-court-700" : ""}`}>{date.getDate()}</div>
              </div>
            );
          })}
          {times.map((time, ti) => (
            <div key={time} className="contents">
              <div className="sticky left-0 z-[1] bg-white pr-1.5 text-right text-[11px] tabular-nums text-zinc-400">
                <span className={`block ${time.endsWith(":00") ? "-translate-y-1.5" : "invisible"}`}>{time}</span>
              </div>
              {days.map((d, di) => {
                const s = d.slots[ti];
                const isSel = selected(di, ti);
                const base = `h-7 border-l border-zinc-100 text-left text-[11px] leading-7 truncate px-1.5 ${time.endsWith(":00") ? "border-t border-t-zinc-200" : "border-t border-t-zinc-100 border-dashed"}`;
                if (s.kind === "rental") {
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => click(di, ti)}
                      title={`${s.label} · ${s.range}`}
                      className={`${base} ${s.first ? "" : "border-t-transparent!"} bg-ball-100 font-semibold text-ball-600 hover:bg-ball-500 hover:text-white ${rental?.rentalId === s.rentalId ? "bg-ball-500! text-white!" : ""}`}
                    >
                      {s.first ? s.label : ""}
                    </button>
                  );
                }
                if (s.kind === "block") {
                  return (
                    <div key={di} title={`Turnuva: ${s.label}`} className={`${base} ${s.first ? "" : "border-t-transparent!"} cursor-not-allowed bg-violet-100 font-semibold text-violet-700`}>
                      {s.first ? `🏓 ${s.label}` : ""}
                    </div>
                  );
                }
                if (s.kind === "past") {
                  return <div key={di} className={`${base} bg-zinc-50 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(0,0,0,0.03)_4px,rgba(0,0,0,0.03)_8px)]`} />;
                }
                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => click(di, ti)}
                    aria-label={`${d.date} ${time}`}
                    className={`${base} transition ${isSel ? "bg-court-600 font-semibold text-white" : "hover:bg-court-50"}`}
                  >
                    {isSel && ti === sel!.start ? `${selStart}-${selEnd}` : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
        <Legend cls="bg-white ring-1 ring-zinc-300" label="Boş" />
        <Legend cls="bg-court-600" label="Seçili" />
        <Legend cls="bg-ball-100 ring-1 ring-ball-500/40" label="Kiralanmış" />
        <Legend cls="bg-violet-100 ring-1 ring-violet-400/40" label="Turnuva" />
        <Legend cls="bg-zinc-100 ring-1 ring-zinc-300" label="Geçmiş" />
      </div>

      {!sel && !rental && (
        <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Kiralamak için takvimde boş bir dilime tıkla (başlangıç), sonra aynı gün bitiş dilimine tıkla.
        </p>
      )}

      {sel && selDate && (
        <form action={create} className="card sticky bottom-4 z-10 flex flex-wrap items-end gap-4 border-court-600/40 shadow-lg">
          <input type="hidden" name="tableId" value={tableId} />
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="date" value={days[sel.day].date} />
          <input type="hidden" name="start" value={selStart} />
          <input type="hidden" name="end" value={selEnd} />
          <div className="min-w-48 flex-1">
            <div className="text-xs font-medium text-zinc-500">Yeni kiralama</div>
            <div className="font-display text-xl font-semibold">{longDate(selDate)}</div>
            <div className="text-sm text-zinc-700">
              {selStart} - {selEnd} · {minutes >= 60 ? `${minutes / 60} saat` : `${minutes} dakika`}
              {price !== null && <span className="ml-2 font-semibold text-court-700">{price.toLocaleString("tr-TR")} ₺</span>}
            </div>
          </div>
          <div>
            <label className="label">Müşteri adı</label>
            <input name="customerName" required autoFocus className="input w-56" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSel(null)} className="btn btn-ghost">Vazgeç</button>
            <button className="btn btn-accent">Kirala</button>
          </div>
        </form>
      )}

      {rental && (
        <form action={cancel} className="card sticky bottom-4 z-10 flex flex-wrap items-center gap-4 border-ball-500/40 shadow-lg">
          <input type="hidden" name="rentalId" value={rental.rentalId} />
          <input type="hidden" name="tableId" value={tableId} />
          <input type="hidden" name="week" value={week} />
          <div className="min-w-48 flex-1">
            <div className="text-xs font-medium text-zinc-500">Kiralama</div>
            <div className="font-display text-xl font-semibold">{rental.label}</div>
            <div className="text-sm text-zinc-700">
              {longDate(dateOf(days[rental.day].date))} · {rental.range} · {Number(rental.amount).toLocaleString("tr-TR")} ₺
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRental(null)} className="btn btn-ghost">Kapat</button>
            <button className="btn bg-red-600 hover:bg-red-700">Kiralamayı iptal et</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${cls}`} /> {label}
    </span>
  );
}
