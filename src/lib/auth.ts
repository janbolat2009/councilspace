import { getServerSession, type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { DomainError } from "./policy";
import { authenticatePassword, acceptGoogleIdentity, ensureAuthEnvironment, isSpecialAdminEmail, ensureMinisterPrivileges } from "@/server/accounts";

export const devLogin = process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_LOGIN === "true";
const adapter = PrismaAdapter(db);
export const authOptions: NextAuthOptions = {
  adapter: {
    ...adapter,
    async getUserByEmail(email: string) {
      await ensureAuthEnvironment();
      return await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) as AdapterUser | null;
    },
    async createUser(data: Omit<AdapterUser, "id">) {
      const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
      await ensureAuthEnvironment(schoolId);
      const email = data.email.toLowerCase();
      const isAdmin = isSpecialAdminEmail(email);
      const user = await db.user.create({
        data: {
          ...data,
          email,
          schoolId,
          globalRole: isAdmin ? "SCHOOL_ADMIN" : "STUDENT",
          onboarded: isAdmin ? true : false,
        }
      }) as AdapterUser;
      if (isAdmin) {
        await ensureMinisterPrivileges(user.id, schoolId);
      }
      return user;
    },
    async linkAccount(account: Parameters<NonNullable<typeof adapter.linkAccount>>[0]) {
      const existing = await db.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId
          }
        }
      });
      if (existing) return existing as Awaited<ReturnType<NonNullable<typeof adapter.linkAccount>>>;
      return await adapter.linkAccount!(account);
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  logger: {
    error(code) { console.error("Authentication failed: " + code); },
    warn(code) { console.warn("Authentication warning: " + code); },
    debug() {}
  },
  providers: [
    CredentialsProvider({
      id: "password", name: "Email и пароль",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Пароль", type: "password" } },
      async authorize(credentials) {
        try {
          const user = await authenticatePassword(credentials);
          return user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
        } catch (error) {
          console.error("[auth authorize error]:", error);
          if (error instanceof DomainError && error.status === 429) throw new Error("TooManyAttempts");
          throw new Error("ServiceUnavailable");
        }
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })] : []),
    ...(devLogin ? [CredentialsProvider({
      id: "demo", name: "Локальная демонстрация",
      credentials: { email: { label: "Демо-профиль", type: "text" } },
      async authorize(credentials, req) {
        const host = req.headers?.host ?? "";
        if (process.env.NODE_ENV !== "development" || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return null;
        const user = await db.user.findUnique({ where: { email: credentials?.email ?? "" } });
        return user?.isDemo && user.schoolId === "demo-school" ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
      }
    })] : [])
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "password") return true;
      if (account?.provider === "demo") return devLogin;
      if (account?.provider !== "google") return false;
      try {
        return await acceptGoogleIdentity(account, profile);
      } catch {
        return "/login?error=ServiceUnavailable";
      }
    },
    async jwt({ token, user }) {
      // The adapter returns the database ID, never Google's subject ID.
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) (session.user as typeof session.user & { id: string }).id = token.sub;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/") && !url.startsWith("//")) return baseUrl + url;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
        if (process.env.NODE_ENV !== "production" && /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(parsed.origin)) {
          return baseUrl + parsed.pathname + parsed.search;
        }
      } catch {}
      return baseUrl + "/auth/complete";
    }
  }
};
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  await ensureAuthEnvironment();
  const id = (session.user as { id?: string } | undefined)?.id;
  let user = null;
  if (id) {
    user = await db.user.findUnique({ where: { id } });
  }
  if (!user && session.user.email) {
    const email = session.user.email.trim().toLowerCase();
    user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, isDemo: false } });
  }
  if (user && isSpecialAdminEmail(user.email)) {
    if (user.globalRole !== "SCHOOL_ADMIN" || !user.onboarded) {
      await ensureMinisterPrivileges(user.id, user.schoolId);
      user = await db.user.findUnique({ where: { id: user.id } });
    }
  }
  return user;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new DomainError("Войдите в аккаунт.", 401);
  return user;
}
