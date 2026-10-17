import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateQuestion } from "@/lib/questions";

// Массовая загрузка вопросов из Excel — основной способ наполнить банк без ИИ.
// GET — шаблон, POST — загрузка заполненного шаблона. Если хоть одна строка
// с ошибкой, ничего не сохраняется: так повторная загрузка не создаёт дублей.

const COLUMNS = [
  { header: "Уровень", key: "level", width: 14 },
  { header: "Тип", key: "type", width: 22 },
  { header: "Вопрос", key: "text", width: 60 },
  { header: "Вариант 1", key: "o1", width: 30 },
  { header: "Вариант 2", key: "o2", width: 30 },
  { header: "Вариант 3", key: "o3", width: 30 },
  { header: "Вариант 4", key: "o4", width: 30 },
  { header: "Правильный вариант (1–4)", key: "correct", width: 14 },
  { header: "Ключевые слова (через запятую)", key: "keywords", width: 40 },
  { header: "Пояснение", key: "explanation", width: 60 },
];

const LEVELS: Record<string, string> = {
  новичок: "BEGINNER",
  beginner: "BEGINNER",
  middle: "MIDDLE",
  мидл: "MIDDLE",
  professional: "PROFESSIONAL",
  профессионал: "PROFESSIONAL",
};

const TYPES: Record<string, string> = {
  "выбор ответа": "MULTIPLE_CHOICE",
  multiple_choice: "MULTIPLE_CHOICE",
  "лучший ответ": "BEST_RESPONSE",
  best_response: "BEST_RESPONSE",
  "открытый": "OPEN",
  open: "OPEN",
  "найди ошибку": "FIND_ERROR",
  find_error: "FIND_ERROR",
  "исправь сообщение": "FIX_MESSAGE",
  fix_message: "FIX_MESSAGE",
};

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Вопросы");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    level: "Новичок",
    type: "Выбор ответа",
    text: "ПРИМЕР (удалите строку): Как обращаться к клиенту в переписке?",
    o1: "На «ты»",
    o2: "На «вы»",
    o3: "Без обращения",
    o4: "По фамилии",
    correct: 2,
    explanation: "Обращение на «вы» — обязательное правило.",
  });
  sheet.addRow({
    level: "Middle",
    type: "Исправь сообщение",
    text: "ПРИМЕР (удалите строку): Перепишите правильно: «Это не к нам, звоните в банк.»",
    keywords: "помогу, подскажу, уточню",
    explanation: "Нужно предложить помощь и подсказать, куда обратиться.",
  });

  const help = wb.addWorksheet("Инструкция");
  help.columns = [{ width: 110 }];
  [
    "Как заполнять лист «Вопросы»:",
    "Уровень: Новичок, Middle или Professional.",
    "Тип: Выбор ответа, Лучший ответ, Открытый, Найди ошибку, Исправь сообщение.",
    "Для «Выбор ответа» и «Лучший ответ» — заполните варианты (минимум 2) и номер правильного варианта.",
    "Для остальных типов — ключевые слова правильного ответа через запятую (по ним ответ проверяется без ИИ).",
    "Пояснение показывается сотруднику в разборе после теста: какой ответ верный и почему.",
    "На каждый уровень нужно минимум 10 вопросов, лучше 5 с вариантами и 5 открытых. Чем больше вопросов — тем разнообразнее тесты.",
    "Строки-примеры удалите перед загрузкой.",
  ].forEach((line) => help.addRow([line]));

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent("шаблон-вопросов.xlsx")}"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const file = (await req.formData()).get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Выберите файл .xlsx" }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать файл — нужен .xlsx по шаблону" }, { status: 400 });
  }
  const sheet = wb.getWorksheet("Вопросы") ?? wb.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "В файле нет листа с вопросами" }, { status: 400 });

  const errors: string[] = [];
  const valid = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const cell = (i: number) => row.getCell(i).text.trim();
    if (COLUMNS.every((_, i) => !cell(i + 1))) continue; // пустая строка
    if (cell(3).startsWith("ПРИМЕР")) continue;

    const level = LEVELS[cell(1).toLowerCase()];
    const type = TYPES[cell(2).toLowerCase()];
    if (!level) {
      errors.push(`Строка ${n}: неизвестный уровень «${cell(1)}»`);
      continue;
    }
    if (!type) {
      errors.push(`Строка ${n}: неизвестный тип «${cell(2)}»`);
      continue;
    }
    // Номер правильного варианта считаем по исходным колонкам (1–4), затем пересчитываем
    // в индекс среди заполненных вариантов.
    const rawOptions = [4, 5, 6, 7].map(cell);
    const correctCol = Number(cell(8)) - 1;
    const filled = rawOptions.map((o, i) => ({ o, i })).filter((x) => x.o);
    const checked = validateQuestion({
      level,
      type,
      text: cell(3),
      options: filled.map((x) => x.o),
      correctIndex: filled.findIndex((x) => x.i === correctCol),
      expectedKeywords: cell(9).split(",").map((k) => k.trim()).filter(Boolean),
      explanation: cell(10),
    });
    if ("error" in checked) errors.push(`Строка ${n}: ${checked.error}`);
    else valid.push(checked.data);
  }

  if (errors.length) return NextResponse.json({ error: "В файле есть ошибки, ничего не загружено", errors }, { status: 400 });
  if (!valid.length) return NextResponse.json({ error: "В файле нет вопросов" }, { status: 400 });

  await db.question.createMany({ data: valid });
  return NextResponse.json({ imported: valid.length });
}
