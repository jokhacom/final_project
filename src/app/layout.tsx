import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { CandiesBackground } from "@/components/CandiesBackground";
import FeedbackButton from "@/components/FeedbackButton";
import { themeInitScript } from "@/components/ThemeToggle";

export const metadata = {
  title: "Тренажер знаний ГЦО",
  description: "Обучение и тестирование сотрудников Группы цифрового обслуживания",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          <CandiesBackground />
          <div className="app">
            <Header />
            {children}
          </div>
          <FeedbackButton />
        </Providers>
      </body>
    </html>
  );
}
