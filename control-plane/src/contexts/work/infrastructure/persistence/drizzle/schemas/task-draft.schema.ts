import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const taskDraft = pgTable('task_draft', {
  taskId: text('task_id')
    .primaryKey()
    .references(() => task.id, { onDelete: 'cascade' }),
  state: bytea('state'),
  generation: integer('generation').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull(),
});
