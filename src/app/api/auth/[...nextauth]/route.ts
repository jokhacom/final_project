import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Уже подключено и готово к работе — активируется, когда features.AUTH_ENABLED = true.
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
