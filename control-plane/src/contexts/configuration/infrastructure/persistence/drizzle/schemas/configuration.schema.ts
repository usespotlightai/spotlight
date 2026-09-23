import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const integrationLink = pgTable(
  'integration_link',
  {
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    handle: text('handle'),
    linkedAt: timestamp('linked_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);

export const skillDefinition = pgTable(
  'skill_definition',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    key: text('key').notNull(),
    files: jsonb('files').$type<Record<string, string>>().notNull(),
    version: integer('version').notNull().default(1),
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.key)],
);
