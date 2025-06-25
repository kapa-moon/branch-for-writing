import { relations } from "drizzle-orm/relations";
import { user, mainDocuments, session, account, documentVersions } from "./schema";

export const mainDocumentsRelations = relations(mainDocuments, ({one}) => ({
	user: one(user, {
		fields: [mainDocuments.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	mainDocuments: many(mainDocuments),
	sessions: many(session),
	accounts: many(account),
	documentVersions: many(documentVersions),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const documentVersionsRelations = relations(documentVersions, ({one}) => ({
	user: one(user, {
		fields: [documentVersions.userId],
		references: [user.id]
	}),
}));