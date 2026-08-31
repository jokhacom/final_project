import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "./db";

// Вход по логину (username) и паролю — обязателен для всех сотрудников,
// включая суперадминистратора. Пароли хранятся только как bcrypt-хеш.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Логин и пароль",
      credentials: {
        username: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await db.user.findUnique({ where: { username: credentials.username } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, username: user.username, role: user.role };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Прокидываем роль и id в токен и в сессию, чтобы UI/эндпоинты могли
    // проверять права доступа (например, доступ в /admin только для ADMIN/SUPERADMIN).
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

// Единственный Суперадминистратор — правило применяется в приложении:
// логин "javokhir" создаётся один раз через seed-скрипт, повторное создание
// пользователя с ролью SUPERADMIN запрещено в /api/auth/register.
export const SUPERADMIN_USERNAME = "javokhir";
