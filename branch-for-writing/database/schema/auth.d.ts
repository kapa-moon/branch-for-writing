// database/schema/auth.d.ts
import type { PgTable } from "drizzle-orm/pg-core";

export declare const user: PgTable;
export declare const session: PgTable;
export declare const account: PgTable;
export declare const verification: PgTable; 