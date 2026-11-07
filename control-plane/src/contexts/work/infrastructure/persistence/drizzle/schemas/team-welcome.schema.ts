import { timestamptz } from '@platform/persistence/drizzle/columns';
import { pgTable, text } from 'drizzle-orm/pg-core';

export const teamWelcome = pgTable('team_welcome', {
  teamId: text('team_id').primaryKey(),
  welcomedAt: timestamptz('welcomed_at').defaultNow().notNull(),
});
