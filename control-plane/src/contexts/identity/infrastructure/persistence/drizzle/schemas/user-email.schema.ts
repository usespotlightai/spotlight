import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userEmail = pgTable(
  'user_email',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    verifiedAt: timestamp('verified_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('user_email_user_email_idx').on(
      table.userId,
      sql`lower(${table.email})`,
    ),
    uniqueIndex('user_email_verified_email_idx')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.verifiedAt} is not null`),
    index('user_email_user_idx').on(table.userId, table.addedAt),
  ],
);

export const verificationSend = pgTable(
  'verification_send',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sentAt: timestamp('sent_at').notNull(),
  },
  (table) => [
    index('verification_send_user_idx').on(table.userId, table.sentAt),
  ],
);
