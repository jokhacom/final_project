import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

// Раздел 3 запроса: экспорт результатов в Excel.
// GET /api/admin/export?userId=...&from=2026-01-01&to=2026-01-31
// userId не указан → экспорт по всем сотрудникам.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: any = { finishedAt: { not: null } };
  if (userId) where.userId = userId;
  if (from || to) {
    where.startedAt = {};
    if (from) where.startedAt.gte = new Date(from);
    if (to) where.startedAt.lte = new Date(to + "T23:59:59");
  }

  const attempts = await db.testAttempt.findMany({
    where,
    include: { user: true, answers: { include: { question: true } } },
    orderBy: { startedAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();

  // Лист 1: сводка по попыткам
  const summary = workbook.addWorksheet("Результаты");
  summary.columns = [
    { header: "Сотрудник", key: "name", width: 24 },
    { header: "Логин", key: "username", width: 18 },
    { header: "Уровень", key: "level", width: 16 },
    { header: "Конфеты", key: "candies", width: 10 },
    { header: "Дата начала", key: "startedAt", width: 20 },
    { header: "Дата завершения", key: "finishedAt", width: 20 },
  ];
  for (const a of attempts) {
    summary.addRow({
      name: a.user.name,
      username: a.user.username,
      level: a.level,
      candies: a.candies,
      startedAt: a.startedAt.toLocaleString("ru-RU"),
      finishedAt: a.finishedAt ? a.finishedAt.toLocaleString("ru-RU") : "",
    });
  }
  summary.getRow(1).font = { bold: true };

  // Лист 2: детализация по каждому ответу
  const details = workbook.addWorksheet("Ответы");
  details.columns = [
    { header: "Сотрудник", key: "name", width: 24 },
    { header: "Вопрос", key: "question", width: 50 },
    { header: "Ответ сотрудника", key: "answer", width: 40 },
    { header: "Верно?", key: "correct", width: 10 },
    { header: "Орф. ошибки", key: "spelling", width: 12 },
    { header: "Грам. ошибки", key: "grammar", width: 12 },
    { header: "Комментарий ИИ", key: "comment", width: 40 },
  ];
  for (const a of attempts) {
    for (const ans of a.answers) {
      details.addRow({
        name: a.user.name,
        question: ans.question.text,
        answer: ans.rawAnswer ?? "",
        correct: ans.isCorrect ? "да" : "нет",
        spelling: ans.spellingErrors,
        grammar: ans.grammarErrors,
        comment: ans.aiComment ?? "",
      });
    }
  }
  details.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = userId
    ? `результаты-${attempts[0]?.user.username ?? userId}.xlsx`
    : `результаты-все-сотрудники.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
