import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { CHOICE_TYPES } from "@/lib/ai/provider";

// Открытые ответы из завершённых тестов для ручной проверки.
// ?status=pending — ещё не проверенные администратором (по умолчанию), all — все.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const pending = req.nextUrl.searchParams.get("status") !== "all";
  const where = {
    question: { type: { notIn: CHOICE_TYPES } },
    attempt: { finishedAt: { not: null } },
    rawAnswer: { not: null },
    ...(pending ? { reviewedAt: null } : {}),
  };

  const [answers, pendingCount] = await Promise.all([
    db.answer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        question: { select: { text: true, modelAnswer: true, expectedKeywords: true, level: true, image: true } },
        attempt: { select: { id: true, candies: true, user: { select: { name: true, username: true } } } },
      },
    }),
    db.answer.count({ where: { ...where, reviewedAt: null } }),
  ]);

  return NextResponse.json({ answers, pendingCount });
}
