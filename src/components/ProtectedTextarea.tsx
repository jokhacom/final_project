"use client";

import { useState, type TextareaHTMLAttributes } from "react";

// Раздел 6 запроса: запрет копирования/вставки/вырезания текста в открытых
// вопросах, чтобы сотрудники не могли вставлять готовые ответы из редполитики.
// Использовать вместо обычного <textarea> на странице прохождения теста.
export function ProtectedTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [warning, setWarning] = useState(false);

  function block(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setWarning(true);
    setTimeout(() => setWarning(false), 2500);
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        {...props}
        onCopy={block}
        onPaste={block}
        onCut={block}
        onContextMenu={(e) => e.preventDefault()} // блокирует контекстное меню с "Вставить"
      />
      {warning && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            background: "#FF5D6C",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          Вставка текста запрещена. Пожалуйста, напишите ответ самостоятельно.
        </div>
      )}
    </div>
  );
}
