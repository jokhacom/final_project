"use client";

import { useState } from "react";
import Link from "next/link";
import { QuestionForm, emptyDraft } from "@/components/admin/QuestionForm";

// Ручное создание вопросов без ИИ. Попадают в тот же банк, что и сгенерированные.
export default function NewQuestionPage() {
  const [saved, setSaved] = useState(0);
  return (
    <div className="card narrow" style={{ margin: "0 auto" }}>
      <div className="row between">
        <h1>Новый вопрос</h1>
        <Link href="/admin/questions" className="btn btn-ghost btn-sm">
          ← Банк вопросов
        </Link>
      </div>
      {saved > 0 && <div className="alert alert-success" style={{ marginBottom: 12 }}>Сохранено вопросов: {saved}</div>}
      <QuestionForm initial={emptyDraft()} onSaved={() => setSaved((n) => n + 1)} />
    </div>
  );
}
