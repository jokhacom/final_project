import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = {
  title: "Тренажер знаний ГЦО",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
