import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdmin } from "@/lib/session";
import { MAX_PRESENTATION_MB, PRESENTATION_TYPES } from "@/lib/presentations";

// Выдаёт браузеру одноразовый токен, чтобы он загрузил файл в Vercel Blob напрямую.
// Запись в базу делает POST /api/learning/presentations после загрузки.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const admin = await requireAdmin();
        if (admin instanceof NextResponse) throw new Error("Нет доступа");
        return {
          allowedContentTypes: Object.values(PRESENTATION_TYPES),
          maximumSizeInBytes: MAX_PRESENTATION_MB * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
