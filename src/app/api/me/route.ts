import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getCabinet } from "@/lib/cabinet";

// Личный кабинет текущего сотрудника.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const cabinet = await getCabinet(user.id);
  if (!cabinet) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json(cabinet);
}
