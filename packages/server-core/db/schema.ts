/**
 * Drizzle schema for einja-management-template (PostgreSQL / Neon DB).
 *
 * Design constraints:
 * - timestamp(3) without timezone to match existing Prisma-managed columns.
 * - Table and column names are kept identical to the Prisma-generated DB schema.
 * - NextAuth tables (accounts/sessions/verificationTokens/authenticators) are
 *   defined to match the @auth/drizzle-adapter expected schema so that future
 *   adapter adoption does not require destructive migrations.
 *   The existing DB uses PascalCase table names from Prisma defaults.
 * - FK and PK constraint names are explicitly set to match Prisma-generated names
 *   so that drizzle-kit does not detect spurious diffs against the existing DB.
 * - ID generation (e.g. cuid) is delegated to the application layer; the schema
 *   only declares `text("id").primaryKey()` without a default generator.
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userStatusEnum = pgEnum("UserStatus", ["active", "inactive", "pending"]);

export const userRoleEnum = pgEnum("UserRole", ["admin", "user", "moderator"]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
	"User",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		email: text("email").notNull(),
		emailVerified: timestamp("emailVerified", { precision: 3 }),
		image: text("image"),
		password: text("password"),
		status: userStatusEnum("status").notNull().default("pending"),
		role: userRoleEnum("role").notNull().default("user"),
		lastLogin: timestamp("lastLogin", { precision: 3 }),
		createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
		updatedAt: timestamp("updatedAt", { precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [uniqueIndex("User_email_key").on(t.email)],
);

// ---------------------------------------------------------------------------
// Accounts (@auth/drizzle-adapter compatible)
// Table name "Account" matches Prisma default (no @@map in original schema).
// FK/PK names match Prisma-generated constraint names to avoid migration diffs.
// ---------------------------------------------------------------------------

export const accounts = pgTable(
	"Account",
	{
		userId: text("userId").notNull(),
		type: text("type").notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
		createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
		updatedAt: timestamp("updatedAt", { precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		primaryKey({
			name: "Account_pkey",
			columns: [t.provider, t.providerAccountId],
		}),
		foreignKey({
			name: "Account_userId_fkey",
			columns: [t.userId],
			foreignColumns: [users.id],
		})
			.onDelete("cascade")
			.onUpdate("cascade"),
	],
);

// ---------------------------------------------------------------------------
// Sessions (@auth/drizzle-adapter compatible)
// ---------------------------------------------------------------------------

export const sessions = pgTable(
	"Session",
	{
		sessionToken: text("sessionToken").notNull(),
		userId: text("userId").notNull(),
		expires: timestamp("expires", { precision: 3 }).notNull(),
		createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
		updatedAt: timestamp("updatedAt", { precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		uniqueIndex("Session_sessionToken_key").on(t.sessionToken),
		foreignKey({
			name: "Session_userId_fkey",
			columns: [t.userId],
			foreignColumns: [users.id],
		})
			.onDelete("cascade")
			.onUpdate("cascade"),
	],
);

// ---------------------------------------------------------------------------
// Verification Tokens (@auth/drizzle-adapter compatible)
// ---------------------------------------------------------------------------

export const verificationTokens = pgTable(
	"VerificationToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { precision: 3 }).notNull(),
	},
	(t) => [
		primaryKey({
			name: "VerificationToken_pkey",
			columns: [t.identifier, t.token],
		}),
	],
);

// ---------------------------------------------------------------------------
// Authenticators (@auth/drizzle-adapter compatible, WebAuthn)
// ---------------------------------------------------------------------------

export const authenticators = pgTable(
	"Authenticator",
	{
		credentialID: text("credentialID").notNull(),
		userId: text("userId").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		credentialPublicKey: text("credentialPublicKey").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credentialDeviceType").notNull(),
		credentialBackedUp: boolean("credentialBackedUp").notNull(),
		transports: text("transports"),
	},
	(t) => [
		primaryKey({
			name: "Authenticator_pkey",
			columns: [t.userId, t.credentialID],
		}),
		uniqueIndex("Authenticator_credentialID_key").on(t.credentialID),
		foreignKey({
			name: "Authenticator_userId_fkey",
			columns: [t.userId],
			foreignColumns: [users.id],
		})
			.onDelete("cascade")
			.onUpdate("cascade"),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	authenticators: many(authenticators),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
	user: one(users, {
		fields: [authenticators.userId],
		references: [users.id],
	}),
}));
