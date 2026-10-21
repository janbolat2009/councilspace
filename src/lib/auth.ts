import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { DomainError } from "./policy";

export const devLogin = process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_LOGIN === "true";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })] : []),
    ...(devLogin ? [CredentialsProvider({
      id: "demo",
      name: "Локальная демонстрация",
      credentials: { email: { label: "Демо-профиль", type: "text" } },
      async authorize(credentials, req) {
        const host = req.headers?.host ?? "";
        if (process.env.NODE_ENV !== "development" || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return null;
        const user = await db.user.findUnique({ where: { email: credentials?.email ?? "" } });
        return user?.isDemo && user.schoolId === "demo-school" ? user : null;
      }
    })] : [])
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "demo") return devLogin;
      const email = (user?.email || (profile as { email?: string })?.email)?.toLowerCase();
      if (!email) return false;
      const domain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
      if (domain && email.split("@")[1] !== domain) return false;

      // Синхронизируем пользователя с PostgreSQL
      try {
        const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
        const name = user?.name || (profile as { name?: string })?.name || "Ученик";
        const image = user?.image || (profile as { picture?: string })?.picture || null;
        
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) {
          user.id = existing.id;
        } else {
          const created = await db.user.create({
            data: {
              email,
              name,
              image,
              schoolId,
              emailVerified: new Date()
            }
          });
          user.id = created.id;
        }
        return true;
      } catch (err) {
        console.error("signIn db sync error:", err);
        // Даже если база временно недоступна, разрешаем вход
        return true;
      }
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      } else if (!token.sub && token.email) {
        try {
          const dbUser = await db.user.findUnique({ where: { email: token.email } });
          if (dbUser) token.sub = dbUser.id;
        } catch (e) {
          console.warn("jwt user lookup error:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) (session.user as typeof session.user & { id: string }).id = token.sub;
      return session;
    }
  }
};
export async function currentUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ? db.user.findUnique({ where: { id } }) : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new DomainError("Войдите в аккаунт.", 401);
  return user;
}
