import { NextRequest, NextResponse } from "next/server";
import { handleUpload, handleUploadPresigned } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { requireAdmin } from "@/lib/session";
import { MAX_PRESENTATION_MB, PRESENTATION_TYPES } from "@/lib/presentations";

const limits = {
  allowedContentTypes: Object.values(PRESENTATION_TYPES),
  maximumSizeInBytes: MAX_PRESENTATION_MB * 1024 * 1024,
};

async function checkAdmin() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) throw new Error("Нет доступа");
}

// Разрешает браузеру загрузить файл в Vercel Blob напрямую. Запись в базу делает
// POST /api/learning/presentations после загрузки. Два вида подключения хранилища:
// - новое (BLOB_STORE_ID, без ключа) — браузер получает подписанную ссылку для загрузки;
// - старое (BLOB_READ_WRITE_TOKEN) — браузер получает одноразовый токен.
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (body.type === "blob.generate-presigned-url") {
      const result = await handleUploadPresigned({
        body,
        request: req,
        getSignedToken: async (pathname) => {
          await checkAdmin();
          const token = await issueSignedToken({ pathname, operations: ["put"], validUntil: Date.now() + 60 * 60 * 1000, ...limits });
          return { token, urlOptions: { addRandomSuffix: true, ...limits } };
        },
      });
      return NextResponse.json(result);
    }
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        await checkAdmin();
        return { ...limits, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
