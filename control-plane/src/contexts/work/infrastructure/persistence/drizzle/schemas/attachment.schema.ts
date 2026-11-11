import { timestamptz } from '@platform/persistence/drizzle/columns';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text } from 'drizzle-orm/pg-core';

export const attachmentClaim = pgTable(
  'attachment_claim',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id'),
    chatId: text('chat_id'),
    claimedAt: timestamptz('claimed_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'attachment_claim_one_holder',
      sql`num_nonnulls(${table.taskId}, ${table.chatId}) = 1`,
    ),
    foreignKey({
      name: 'attachment_claim_task_fk',
      columns: [table.workspaceId, table.taskId],
      foreignColumns: [task.workspaceId, task.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'attachment_claim_chat_fk',
      columns: [table.workspaceId, table.chatId],
      foreignColumns: [chat.workspaceId, chat.id],
    }).onDelete('cascade'),
    index('attachment_claim_task_idx').on(table.taskId),
    index('attachment_claim_chat_idx').on(table.chatId),
  ],
);
