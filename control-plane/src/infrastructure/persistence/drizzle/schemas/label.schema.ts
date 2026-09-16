import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { team } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const label = pgTable(
  'label',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    colour: text('colour').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('label_team_idx').on(table.teamId)],
);

export const taskLabel = pgTable(
  'task_label',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => label.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.labelId] }),
    index('task_label_task_idx').on(table.taskId),
    index('task_label_label_idx').on(table.labelId),
  ],
);
