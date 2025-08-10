// database/schema/index.ts
// This file will be populated by better-auth

// Import auth tables first
export * from './auth'; // better-auth will generate this file
import { user } from './auth'; // Import user table for foreign key reference

// You can also define your own application-specific tables here
import { pgTable, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

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
  discussionNotes: text('discussion_notes'), // NEW: Notes for discussion purposes
  prepNotes: text('prep_notes'), // NEW: Preparation notes
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
  aiCommentId: text('ai_comment_id'), // Reference to specific AI comment this chat is about (nullable)
  threadId: text('thread_id'), // Thread identifier for grouping related messages (nullable)
  userPrompt: text('user_prompt').notNull(), // User's input message
  aiOutput: text('ai_output').notNull(), // AI's response
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// AI discussion insights table for caching AI insights from discussion notes
export const aiDiscussionInsights = pgTable('ai_discussion_insights', {
  id: text('id').primaryKey(),
  mainDocId: text('main_doc_id').notNull(), // Reference to main document
  refDocId: text('ref_doc_id').notNull(), // Reference to document version with discussion notes
  insightResults: jsonb('insight_results').notNull(), // Store the complete AI insight analysis
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// Keystroke logs table for real-time keystroke tracking in Google Docs
export const keystrokeLogs = pgTable('keystroke_logs', {
  id: text('id').primaryKey(),
  docId: text('doc_id').notNull(), // Google Doc ID from URL
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(), // Session identifier (e.g., 'Drafting', 'Editing')
  timestamp: timestamp('timestamp').notNull(), // When the keystroke occurred
  beforeText: text('before_text').notNull(), // Text before the change
  afterText: text('after_text').notNull(), // Text after the change
  diffData: jsonb('diff_data').notNull(), // diff-match-patch results as JSON
  actionType: text('action_type').notNull(), // 'insert', 'delete', 'replace', 'paste', 'undo', etc.
  cursorPosition: integer('cursor_position'), // Cursor position when change occurred
  textLengthBefore: integer('text_length_before').notNull(), // Character count before change
  textLengthAfter: integer('text_length_after').notNull(), // Character count after change
  keystrokeCount: integer('keystroke_count').default(1), // Number of keystrokes in this event
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

// AI platform messages table for logging conversations from various AI platforms
export const aiPlatformMessages = pgTable('ai_platform_messages', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(), // 'chatgpt', 'claude', 'gemini', etc.
  conversationId: text('conversation_id').notNull(), // Unique identifier for the conversation/thread
  messageId: text('message_id').notNull(), // Platform-specific message ID to avoid duplicates
  sender: text('sender').notNull(), // 'user' or 'ai'
  content: text('content').notNull(), // The message content
  timestamp: timestamp('timestamp').notNull(), // When the message was sent/received
  metadata: jsonb('metadata'), // Additional platform-specific data (optional)
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}); 