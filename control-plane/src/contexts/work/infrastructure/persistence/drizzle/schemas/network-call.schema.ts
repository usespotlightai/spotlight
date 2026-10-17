import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const networkCall = pgTable(
  'network_call',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    method: text('method').notNull(),
    url: text('url').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().notNull(),
    body: text('body').notNull(),
    timeoutMs: integer('timeout_ms').notNull(),
    queuedAt: timestamp('queued_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    state: text('state').notNull(),
    claimedBy: text('claimed_by'),
    claimedAt: timestamp('claimed_at'),
    answeredAt: timestamp('answered_at'),
    answerStatus: integer('answer_status'),
    answerHeaders: jsonb('answer_headers').$type<Record<string, string>>(),
    answerBody: text('answer_body'),
    answerMs: integer('answer_ms'),
    answerError: text('answer_error'),
    expiredAt: timestamp('expired_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('network_call_waiting_idx').on(
      table.workspaceId,
      table.state,
      table.queuedAt,
    ),
    index('network_call_expiring_idx').on(table.state, table.expiresAt),
    index('network_call_answered_idx').on(table.state, table.answeredAt),
    index('network_call_expired_idx').on(table.state, table.expiredAt),
  ],
);
