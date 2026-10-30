import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assistantAccess } from "@/lib/assistant";
import { requireUser } from "@/lib/session";

// История «Помощника ответов» сотрудника: поиск по тексту, только избранное (fav=1), по виду (mode).
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await assistantAccess(user)).allowed) return NextResponse.json({ error: "Только для премиум-пользователей" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const fav = req.nextUrl.searchParams.get("fav") === "1";
  const mode = req.nextUrl.searchParams.get("mode");
  const items = await db.assistantReply.findMany({
    where: {
      userId: user.id,
      ...(fav ? { favorite: true } : {}),
      ...(mode === "reply" || mode === "check" || mode === "coach" ? { mode } : {}),
      // Ищем по сообщению клиента и черновику; по ответам ИИ (JSON) — после выборки ниже.
    },
    orderBy: { createdAt: "desc" },
    take: q ? 500 : 100,
  });
  const needle = q.toLowerCase();
  const found = q ? items.filter((i) => `${i.input}\n${i.draft ?? ""}\n${JSON.stringify(i.result)}`.toLowerCase().includes(needle)).slice(0, 100) : items;
  return NextResponse.json({ items: found });
}
