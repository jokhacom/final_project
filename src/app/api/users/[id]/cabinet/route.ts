import { NextResponse } from "next/server";
import { isAdmin, requireUser } from "@/lib/session";
import { getCabinet } from "@/lib/cabinet";

// Кабинет сотрудника для администратора (свой кабинет — /api/me).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  if (id !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const cabinet = await getCabinet(id);
  if (!cabinet) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json(cabinet);
}
