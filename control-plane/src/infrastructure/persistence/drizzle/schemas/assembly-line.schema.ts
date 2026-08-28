import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const assemblyLine = pgTable(
  'assembly_line',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    factoryId: text('factory_id')
      .notNull()
      .references(() => factory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('assembly_line_factory_idx').on(table.factoryId),
    index('assembly_line_workspace_idx').on(table.workspaceId),
  ],
);

/** No unique constraint on `position`: Postgres checks per row, so swapping
 *  two in one statement would fail. Reordering arrives before it would pay. */
export const station = pgTable(
  'station',
  {
    id: text('id').primaryKey(),
    assemblyLineId: text('assembly_line_id')
      .notNull()
      .references(() => assemblyLine.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    color: text('color').notNull().default('#a3a8b0'),
    description: text('description'),
    pool: text('pool'),
    agentPrompt: text('agent_prompt'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('station_assembly_line_idx').on(table.assemblyLineId)],
);
