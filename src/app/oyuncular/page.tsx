import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentSalon } from "@/lib/salon";
import { PROVISIONAL_MATCHES, STARTING_ELO } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const LEVELS = [
  { value: "BASLANGIC", label: "Başlangıç (1200)" },
  { value: "ORTA", label: "Orta (1500)" },
  { value: "ILERI", label: "İleri (1800)" },
] as const;

async function addPlayer(formData: FormData) {
  "use server";
  const salon = await currentSalon();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const level = String(formData.get("level")) as keyof typeof STARTING_ELO;
  if (!name) return;
  const player = email
    ? await db.player.upsert({ where: { email }, update: { name }, create: { name, email } })
    : await db.player.create({ data: { name } });
  await db.salonPlayer.upsert({
    where: { salonId_playerId: { salonId: salon.id, playerId: player.id } },
    update: {},
    create: { salonId: salon.id, playerId: player.id, elo: STARTING_ELO[level] ?? STARTING_ELO.ORTA },
  });
  revalidatePath("/oyuncular");
}

export default async function PlayersPage() {
  const salon = await currentSalon();
  const players = await db.salonPlayer.findMany({
    where: { salonId: salon.id },
    include: { player: true },
    orderBy: { elo: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1>Oyuncular ve ELO sıralaması</h1>
      <form action={addPlayer} className="card flex flex-wrap items-end gap-3">
        <div><label className="label">Ad soyad</label><input name="name" required className="input" /></div>
        <div><label className="label">E-posta (giriş için)</label><input name="email" type="email" className="input" /></div>
        <div>
          <label className="label">Başlangıç seviyesi</label>
          <select name="level" defaultValue="ORTA" className="input">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <button className="btn">Oyuncu ekle</button>
      </form>
      <table className="card w-full text-sm">
        <thead><tr className="text-left text-zinc-500"><th className="py-2">#</th><th>Oyuncu</th><th>ELO</th><th>Maç</th></tr></thead>
        <tbody className="divide-y">
          {players.map((p, i) => (
            <tr key={p.id}>
              <td className="py-2">{i + 1}</td>
              <td>{p.player.name}</td>
              <td className="font-medium">{p.elo}</td>
              <td>
                {p.matchesCount}
                {p.matchesCount < 5 && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">geçici</span>}
                {p.matchesCount < PROVISIONAL_MATCHES && p.matchesCount >= 5 && <span className="ml-2 text-xs text-zinc-500">oturuyor</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
