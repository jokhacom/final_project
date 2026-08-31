import { PrismaClient } from "@prisma/client";

// Стандартный singleton-паттерн для Next.js, чтобы не плодить соединения с БД
// при hot-reload в разработке.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
