import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Раздел 2 запроса: роли. Доступ в /admin/* только для ADMIN и SUPERADMIN —
// обычный сотрудник (EMPLOYEE), даже авторизованный, получает редирект.
export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token as any)?.role;
    if (!role || (role !== "ADMIN" && role !== "SUPERADMIN")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // должен быть залогинен, роль проверяется выше
    },
  }
);

export const config = {
  matcher: ["/admin/:path*"],
};
