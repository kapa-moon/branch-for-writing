// database/schema/index.ts
// This file will be populated by better-auth

// Import auth tables first
export * from './auth'; // better-auth will generate this file
import { user } from './auth'; // Import user table for foreign key reference

// You can also define your own application-specific tables here
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Version table for storing document versions
export const documentVersions = pgTable('document_versions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  content: jsonb('content').notNull(), // Store TiptapDocument as JSONB
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}); 