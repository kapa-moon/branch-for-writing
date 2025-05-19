import { betterAuth } from "better-auth";
import { db } from "./db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "../../database/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
    // You can add more email/password options here if needed
  },
  // Add other providers or plugins here as you expand
  // e.g., social logins, 2FA, etc.
});

export type { Session, User } from "better-auth";