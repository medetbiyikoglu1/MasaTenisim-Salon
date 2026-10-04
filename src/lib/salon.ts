import { db } from "./db";

/** Pilot aşamasında uygulama tek salonla çalışır. */
export async function currentSalon() {
  const salon = await db.salon.findFirst({ orderBy: { createdAt: "asc" } });
  if (!salon) throw new Error("Salon bulunamadı: önce `npm run db:seed` çalıştır");
  return salon;
}
