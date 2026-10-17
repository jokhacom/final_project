import { NextRequest, NextResponse } from "next/server";

// Сертификат теперь — страница /certificate/[attemptId] (кириллица, печать в PDF
// из браузера). Старая ссылка оставлена и перенаправляет туда.
export async function GET(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return NextResponse.redirect(new URL(`/certificate/${attemptId}`, req.url));
}
