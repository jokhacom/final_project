import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { levelReadiness } from "@/lib/readiness";
import { AI_KEY_ENV, features } from "@/lib/config/features";
import { SUPERADMIN_USERNAME } from "@/lib/auth";
import { CHOICE_TYPES } from "@/lib/ai/provider";

// Чек-лист готовности к запуску для админ-панели.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const [levels, superadmin, employees, materials, pendingReviews] = await Promise.all([
    levelReadiness(),
    db.user.findUnique({ where: { username: SUPERADMIN_USERNAME }, select: { id: true } }),
    db.user.count({ where: { role: "EMPLOYEE" } }),
    db.material.count({ where: { isActive: true } }),
    db.answer.count({
      where: { reviewedAt: null, rawAnswer: { not: null }, question: { type: { notIn: CHOICE_TYPES } }, attempt: { finishedAt: { not: null } } },
    }),
  ]);

  return NextResponse.json({
    superadmin: !!superadmin,
    employees,
    materials,
    pendingReviews,
    levels,
    ai: {
      provider: features.AI_PROVIDER,
      configured: features.AI_CONFIGURED,
      keyEnv: AI_KEY_ENV[features.AI_PROVIDER],
      gradingMode: features.GRADING_MODE,
    },
    email: !!(process.env.SMTP_HOST && process.env.FEEDBACK_EMAIL),
  });
}
