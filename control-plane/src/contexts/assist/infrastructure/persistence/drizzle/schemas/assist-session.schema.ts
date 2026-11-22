import type { AssistProgressStatus } from '@assist/domain/aggregates/assist-session.aggregate';
import { ASSIST_FAILURE_REASONS } from '@assist/domain/value-objects/assist-failure-reason.vo';
import {
  amount,
  isCurrencyCode,
  literals,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
import type { JsonObject, JsonValue } from '@shared-kernel/domain/json-value';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const ASSIST_SESSION_STATUSES = [
  'ordered',
  'running',
  'submitted',
  'failed',
] as const satisfies readonly AssistProgressStatus[];

export const assistSession = pgTable(
  'assist_session',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    purpose: text('purpose').notNull(),
    key: text('key').notNull(),
    basedOnRunId: text('based_on_run_id').notNull(),
    runId: text('run_id').notNull(),
    resultSchema: jsonb('result_schema').$type<JsonObject>().notNull(),
    status: text('status').notNull(),
    model: text('model'),
    result: jsonb('result').$type<JsonValue>(),
    failure: text('failure'),
    usageRecorded: boolean('usage_recorded').notNull().default(false),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cost: amount('cost'),
    currency: text('currency'),
    orderedAt: timestamptz('ordered_at').notNull(),
    settledAt: timestamptz('settled_at'),
    runEndedAt: timestamptz('run_ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('assist_session_order_idx').on(
      table.workspaceId,
      table.purpose,
      table.key,
    ),
    uniqueIndex('assist_session_run_idx').on(table.runId),
    check(
      'assist_session_status',
      sql`${table.status} in (${literals(ASSIST_SESSION_STATUSES)})`,
    ),
    check(
      'assist_session_failure',
      sql`(${table.status} = 'failed') = (${table.failure} is not null) and (${table.failure} is null or ${table.failure} in (${literals(ASSIST_FAILURE_REASONS)}))`,
    ),
    check(
      'assist_session_model',
      sql`(${table.status} in ('running', 'submitted')) = (${table.model} is not null)`,
    ),
    check('assist_session_currency_code', isCurrencyCode(table.currency)),
  ],
);
