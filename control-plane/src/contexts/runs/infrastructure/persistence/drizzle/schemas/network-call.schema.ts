import { timestamptz } from '@platform/persistence/drizzle/columns';
import { NETWORK_CALL_STATES } from '@runs/domain/aggregates/network-call.aggregate';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const networkCallState = pgEnum(
  'network_call_state',
  NETWORK_CALL_STATES,
);

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
    secrets: text('secrets').array().notNull().default(sql`'{}'::text[]`),
    secretsTokenHash: text('secrets_token_hash'),
    secretsRedeemedAt: timestamptz('secrets_redeemed_at'),
    queuedAt: timestamptz('queued_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    state: networkCallState('state').notNull(),
    claimedBy: text('claimed_by'),
    claimedAt: timestamptz('claimed_at'),
    respondedAt: timestamptz('responded_at'),
    responseStatus: integer('response_status'),
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
    responseBody: text('response_body'),
    responseMs: integer('response_ms'),
    responseError: text('response_error'),
    abandonedAt: timestamptz('abandoned_at'),
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
    index('network_call_abandoned_idx').on(table.state, table.abandonedAt),
  ],
);
