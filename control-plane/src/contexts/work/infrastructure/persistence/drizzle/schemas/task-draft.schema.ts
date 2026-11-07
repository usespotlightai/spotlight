import { timestamptz } from '@platform/persistence/drizzle/columns';
import { customType, pgTable, text } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const taskDraftState = pgTable('task_draft_state', {
  taskId: text('task_id').primaryKey(),
  state: bytea('state').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});
