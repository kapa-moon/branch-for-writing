// database/schema/index.ts
// This file will be populated by better-auth

// You can also define your own application-specific tables here
// For example:
// import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
//
// export const posts = pgTable('posts', {
//   id: serial('id').primaryKey(),
//   title: text('title').notNull(),
//   content: text('content'),
//   createdAt: timestamp('created_at').defaultNow().notNull(),
// });

// Export everything from this file
export * from './auth'; // better-auth will generate this file 