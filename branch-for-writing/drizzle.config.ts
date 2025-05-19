import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("Error loading .env file:", result.error);
  throw result.error;
}

console.log("Parsed .env variables:", result.parsed);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL after dotenv.config():", process.env.DATABASE_URL);
  throw new Error("DATABASE_URL is not set or not loaded correctly from .env file");
}

console.log("DATABASE_URL successfully loaded:", process.env.DATABASE_URL);

export default {
  schema: "./database/schema/index.ts",
  out: "./database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config; 