import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Все страницы, кроме входа, — только для вошедших (иначе редирект на "/login").
// /admin/* — дополнительно только для ADMIN и SUPERADMIN.
export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname.startsWith("/admin")) {
      const role = (req.nextauth.token as any)?.role;
      if (role !== "ADMIN" && role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/levels", req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/levels",
    "/learn",
    "/test/:path*",
    "/result/:path*",
    "/me",
    "/leaderboard",
    "/whats-new",
    "/certificate/:path*",
  ],
};
