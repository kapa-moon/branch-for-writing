import { AuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import EmailProvider from "next-auth/providers/resend";

export const authOptions: AuthOptions = {
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      // Resend example
      from: "login@your-domain.com",
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
};