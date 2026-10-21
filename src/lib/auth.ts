import { getServerSession, type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdapterUser } from "next-auth/adapters";
import { db } from "./db";
import { DomainError } from "./policy";
const baseAdapter = PrismaAdapter(db);
export const devLogin = process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_LOGIN === "true";
export const authOptions: NextAuthOptions = {
  adapter: {
    ...baseAdapter,
    async createUser(data: Omit<AdapterUser, "id">) {
      const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
      const existing = data.email ? await db.user.findUnique({ where: { email: data.email } }) : null;
      if (existing) {
        return (await db.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || data.name,
            image: existing.image || data.image,
            emailVerified: existing.emailVerified || data.emailVerified
          }
        })) as AdapterUser;
      }
      return (await db.user.create({
        data: { ...data, schoolId }
      })) as AdapterUser;
    }
  },
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
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
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
