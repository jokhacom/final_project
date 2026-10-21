import { NextRequest, NextResponse } from "next/server";
import { contentDisposition } from "@/lib/download";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/session";
import { buildAnalytics, parseDays } from "@/lib/analytics";
import { levelInfo } from "@/lib/levels";

// Аналитика за период в Excel: сводка, по дням, по уровням, по сотрудникам, сложные вопросы, слабые темы, все результаты.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const a = await buildAnalytics(parseDays(req.nextUrl.searchParams.get("days")));
  const period = a.days ? `за ${a.days} дн.` : "за всё время";

  const wb = new ExcelJS.Workbook();
  const sheet = (name: string, columns: { header: string; key: string; width: number }[], rows: object[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns;
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    return ws;
  };

  sheet("Сводка", [{ header: `Показатель (${period})`, key: "k", width: 36 }, { header: "Значение", key: "v", width: 14 }], [
    { k: "Сотрудников", v: a.employees },
    { k: "Пройдено тестов", v: a.testsDone },
    { k: "Средний результат, конфет", v: a.avgTeamCandy },
    { k: "Результатов больше 90 (сертификат)", v: a.certificates },
  ]);
  sheet("По дням", [{ header: "Дата", key: "date", width: 14 }, { header: "Тестов", key: "tests", width: 10 }, { header: "Средний результат", key: "avg", width: 18 }],
    a.daily.map((d) => ({ ...d, avg: d.avg ?? "" })));
  sheet("По уровням", [{ header: "Уровень", key: "label", width: 24 }, { header: "Тестов", key: "tests", width: 10 }, { header: "Средний", key: "avg", width: 10 }, { header: "Лучший", key: "best", width: 10 }], a.byLevel);
  sheet("По сотрудникам", [
    { header: "Сотрудник", key: "name", width: 26 }, { header: "Логин", key: "username", width: 16 }, { header: "Тестов", key: "tests", width: 10 },
    { header: "Средний", key: "avg", width: 10 }, { header: "Лучший", key: "best", width: 10 }, { header: "Последний тест", key: "last", width: 20 },
  ], a.byEmployee.map((e) => ({ ...e, last: e.last.toLocaleString("ru-RU") })));
  sheet("Сложные вопросы", [{ header: "Вопрос", key: "text", width: 70 }, { header: "Уровень", key: "level", width: 16 }, { header: "Ответов", key: "total", width: 10 }, { header: "Неверных, %", key: "wrongPercent", width: 12 }],
    a.hardestQuestions.map((q) => ({ ...q, level: levelInfo(q.level).label })));
  sheet("Слабые темы", [{ header: "Тема", key: "topic", width: 50 }, { header: "Сколько раз", key: "count", width: 12 }], a.hardestTopics);
  sheet("Результаты", [{ header: "Сотрудник", key: "name", width: 26 }, { header: "Уровень", key: "level", width: 18 }, { header: "Конфеты", key: "candies", width: 10 }, { header: "Дата", key: "date", width: 20 }],
    a.results.map((r) => ({ name: r.name, level: levelInfo(r.level).label, candies: r.candies, date: r.finishedAt?.toLocaleString("ru-RU") ?? "" })));

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`аналитика-${a.days ? a.days + "-дней" : "всё-время"}.xlsx`, `analytics-${a.days ? a.days + "d" : "all"}.xlsx`),
    },
  });
}
