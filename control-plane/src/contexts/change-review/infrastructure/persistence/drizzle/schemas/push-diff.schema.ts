import { PUSH_DIFF_STATUSES } from '@change-review/domain/aggregates/push-diff.aggregate';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  uniqueIndex,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const pushDiffStatus = pgEnum('push_diff_status', PUSH_DIFF_STATUSES);

export const pushDiff = pgTable(
  'push_diff',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    repository: text('repository').notNull(),
    head: text('head').notNull(),
    baseTip: text('base_tip').notNull(),
    pushedBy: text('pushed_by'),
    pushedAt: timestamptz('pushed_at').notNull(),
    placement: jsonb('placement')
      .$type<readonly (readonly string[])[]>()
      .notNull(),
    placementImage: text('placement_image'),
    status: pushDiffStatus('status').notNull(),
    failure: text('failure'),
    claimedBy: text('claimed_by'),
    attempts: integer('attempts').notNull(),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    claimedAt: timestamptz('claimed_at'),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamptz('reserved_until'),
    provisionAttempts: integer('provision_attempts').notNull(),
    nextProvisionAttemptAt: timestamptz('next_provision_attempt_at'),
    recordedAt: timestamptz('recorded_at').notNull(),
    version: integer('version').notNull(),
  },
  (table) => [
    check('push_diff_attempts_not_negative', sql`${table.attempts} >= 0`),
    check(
      'push_diff_provision_attempts_not_negative',
      sql`${table.provisionAttempts} >= 0`,
    ),
    check(
      'push_diff_failed_with_failure',
      sql`(${table.status} = 'failed') = (${table.failure} IS NOT NULL)`,
    ),
    index('push_diff_task_idx').on(table.taskId, table.repository),
    uniqueIndex('push_diff_waiting_head_idx')
      .on(table.taskId, sql`lower(${table.repository})`, table.head)
      .where(sql`${table.status} = 'waiting'`),
    index('push_diff_waiting_idx').on(table.workspaceId, table.status),
    index('push_diff_reserved_idx').on(table.reservedFor),
  ],
);
