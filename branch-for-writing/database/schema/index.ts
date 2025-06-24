// database/schema/index.ts
// This file will be populated by better-auth

// Import auth tables first
export * from './auth'; // better-auth will generate this file
import { user } from './auth'; // Import user table for foreign key reference

// You can also define your own application-specific tables here
import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

// Main document table for tracking the current working document in the editor
export const mainDocuments = pgTable('main_documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('Untitled Article'),
  content: jsonb('content').notNull(), // Store TiptapDocument as JSONB
  isLocked: boolean('is_locked').notNull().default(false), // NEW: Distinguish working drafts from locked versions
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// Version table for storing document versions (user-created named versions)
export const documentVersions = pgTable('document_versions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  content: jsonb('content').notNull(), // Store TiptapDocument as JSONB
  supporter: text('supporter'), // NEW: Supporter field that can be NULL
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}); 