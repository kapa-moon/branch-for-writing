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
  merged: boolean('merged').notNull().default(false), // NEW: Track whether version has been merged
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// AI comparison results table for caching AI diffing results
export const aiComparisonResults = pgTable('ai_comparison_results', {
  id: text('id').primaryKey(),
  mainDocId: text('main_doc_id').notNull(), // Reference to main document or version being compared
  refDocId: text('ref_doc_id').notNull(), // Reference to comparison document or version
  comparisonResults: jsonb('comparison_results').notNull(), // Store the complete AI analysis results
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// AI chat record table for storing chat interactions
export const aiChatRecords = pgTable('ai_chat_records', {
  id: text('id').primaryKey(),
  mainDocId: text('main_doc_id'), // Reference to main document (nullable)
  refDocId: text('ref_doc_id'), // Reference to comparison document (nullable)
  contextContent: text('context_content'), // Selected text context (nullable)
  userPrompt: text('user_prompt').notNull(), // User's input message
  aiOutput: text('ai_output').notNull(), // AI's response
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}); 