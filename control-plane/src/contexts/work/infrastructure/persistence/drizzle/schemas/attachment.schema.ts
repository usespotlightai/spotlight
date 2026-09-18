import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const attachmentClaim = pgTable(
  'attachment_claim',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').references(() => task.id, { onDelete: 'cascade' }),
    chatId: text('chat_id').references(() => chat.id, { onDelete: 'cascade' }),
    claimedAt: timestamp('claimed_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'attachment_claim_one_holder',
      sql`num_nonnulls(${table.taskId}, ${table.chatId}) = 1`,
    ),
    index('attachment_claim_task_idx').on(table.taskId),
    index('attachment_claim_chat_idx').on(table.chatId),
  ],
);
