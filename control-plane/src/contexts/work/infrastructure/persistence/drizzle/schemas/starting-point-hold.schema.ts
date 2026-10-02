import { sql } from 'drizzle-orm';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const startingPointHold = pgTable('starting_point_hold', {
  holder: text('holder').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  runIds: text('run_ids').array().notNull().default(sql`'{}'::text[]`),
  version: integer('version').notNull().default(0),
});
