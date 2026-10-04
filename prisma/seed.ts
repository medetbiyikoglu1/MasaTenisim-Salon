import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Pilot salon: 5 masa, hafta içi ve hafta sonu saatlik ücret. */
async function main() {
  const existing = await db.salon.findFirst();
  if (existing) return;
  await db.salon.create({
    data: {
      name: "Pilot Salon",
      tables: { create: [1, 2, 3, 4, 5].map((number) => ({ number })) },
      priceRules: {
        create: [
          { dayType: "WEEKDAY", hourlyRate: 200 },
          { dayType: "WEEKEND", hourlyRate: 250 },
        ],
      },
    },
  });
}

main().finally(() => db.$disconnect());
