import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 21 запроса: прозрачность — Super Admin должен видеть цепочку
// Question → Topic → Rule → Source Document. Этот эндпоинт отдаёт темы и
// правила конкретного материала вместе со связанными вопросами.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topics = await db.topic.findMany({
    where: { materialId: id },
    include: {
      rules: { include: { questions: { select: { id: true, text: true, type: true } } } },
      questions: { select: { id: true, text: true, type: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ topics });
}
