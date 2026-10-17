"use client";

import { useState, type TextareaHTMLAttributes } from "react";

// Запрет копирования/вставки/вырезания текста в открытых вопросах, чтобы
// сотрудники не вставляли готовые ответы из редполитики.
export function ProtectedTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [warning, setWarning] = useState(false);

  function block(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setWarning(true);
    setTimeout(() => setWarning(false), 2500);
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        {...props}
        className={`textarea ${props.className ?? ""}`}
        onCopy={block}
        onPaste={block}
        onCut={block}
        onDrop={block}
        onContextMenu={(e) => e.preventDefault()}
        autoComplete="off"
        spellCheck={false}
      />
      {warning && (
        <div className="alert alert-error" style={{ position: "absolute", left: 8, right: 8, bottom: 8, textAlign: "center" }}>
          Вставка текста запрещена. Пожалуйста, напишите ответ самостоятельно.
        </div>
      )}
    </div>
  );
}
