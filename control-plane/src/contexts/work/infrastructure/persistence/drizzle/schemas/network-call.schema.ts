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
    respondedAt: timestamp('responded_at'),
    responseStatus: integer('response_status'),
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
    responseBody: text('response_body'),
    responseMs: integer('response_ms'),
    responseError: text('response_error'),
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
    index('network_call_responded_idx').on(table.state, table.respondedAt),
    index('network_call_expired_idx').on(table.state, table.expiredAt),
  ],
);
