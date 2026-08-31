import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/lib/db";

// Раздел 21: результат выше 90 🍬 → автоматически создается сертификат.
export async function GET(_req: NextRequest, { params }: { params: { attemptId: string } }) {
  const attempt = await db.testAttempt.findUnique({
    where: { id: params.attemptId },
    include: { user: true },
  });

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  if (attempt.candies <= 90) {
    return NextResponse.json({ error: "Сертификат выдаётся только при результате выше 90" }, { status: 403 });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 альбомная
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 20, y: 20, width: 802, height: 555, borderColor: rgb(0.48, 0.3, 1), borderWidth: 3 });

  page.drawText("СЕРТИФИКАТ", { x: 300, y: 480, size: 32, font, color: rgb(0.48, 0.3, 1) });
  page.drawText("Тренажер знаний ГЦО", { x: 320, y: 440, size: 14, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  page.drawText(attempt.user.name, { x: 300, y: 360, size: 24, font });
  page.drawText(`Уровень: ${attempt.level}`, { x: 300, y: 320, size: 14, font: fontRegular });
  page.drawText(`Результат: ${attempt.candies} из 100`, { x: 300, y: 295, size: 14, font: fontRegular });
  page.drawText(`Дата: ${new Date(attempt.finishedAt ?? attempt.startedAt).toLocaleDateString("ru-RU")}`, {
    x: 300,
    y: 270,
    size: 14,
    font: fontRegular,
  });

  const bytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${attempt.user.name}.pdf"`,
    },
  });
}
