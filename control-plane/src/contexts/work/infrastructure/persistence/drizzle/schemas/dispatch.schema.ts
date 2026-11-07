import { timestamptz } from '@platform/persistence/drizzle/columns';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { BriefedMemoriesParts } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTaskParts } from '@work/domain/value-objects/briefed-task.vo';
import { DISPATCH_REFUSALS } from '@work/domain/value-objects/dispatch-refusal';
import type { TrialRepository } from '@work/domain/value-objects/dispatch-subject.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const dispatchKind = pgEnum('dispatch_kind', ['task', 'chat', 'trial']);

export const dispatchOutcome = pgEnum('dispatch_outcome', [
  'completed',
  'failed',
  'exhausted',
  'cancelled',
]);

export const dispatchRefusal = pgEnum('dispatch_refusal', DISPATCH_REFUSALS);

export const dispatch = pgTable(
  'dispatch',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    kind: dispatchKind('kind').notNull(),
    taskId: text('task_id'),
    taskRevision: integer('task_revision'),
    stationId: text('station_id'),
    chatId: text('chat_id'),
    basedOnRunId: text('based_on_run_id'),
    asOf: timestamptz('as_of'),
    trialRepositories:
      jsonb('trial_repositories').$type<readonly TrialRepository[]>(),
    followUp: jsonb('follow_up').$type<JsonObject>(),
    order: jsonb('order').$type<JsonObject>(),
    briefedTask: jsonb('briefed_task').$type<BriefedTaskParts>(),
    briefing: text('briefing'),
    briefedMemories: jsonb('briefed_memories')
      .$type<BriefedMemoriesParts>()
      .notNull()
      .default({ briefed: [], omitted: [] }),
    stationConfig: jsonb('station_config').$type<StationConfigParts>(),
    stationFingerprint: text('station_fingerprint'),
    orderedAt: timestamptz('ordered_at').notNull(),
    enqueued: boolean('enqueued').notNull().default(false),
    refused: dispatchRefusal('refused'),
    detachedAt: timestamptz('detached_at'),
    endedAt: timestamptz('ended_at'),
    outcome: dispatchOutcome('outcome'),
    failure: text('failure'),
    stopped: boolean('stopped').notNull().default(false),
    superseded: boolean('superseded').notNull().default(false),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('dispatch_task_idx').on(table.taskId, table.orderedAt),
    index('dispatch_station_ended_idx').on(table.stationId, table.endedAt),
    index('dispatch_station_fingerprint_idx').on(table.stationFingerprint),
    index('dispatch_chat_idx').on(table.chatId),
    index('dispatch_based_on_idx').on(table.basedOnRunId),
    check(
      'dispatch_station_config_check',
      sql`(${table.stationConfig} is null) = (${table.stationFingerprint} is null)`,
    ),
    check(
      'dispatch_ending_check',
      sql`(${table.endedAt} is null) = (${table.outcome} is null)`,
    ),
    check(
      'dispatch_subject_check',
      sql`case ${table.kind}
        when 'task' then ${table.taskId} is not null and ${table.taskRevision} is not null and ${table.stationId} is not null and ${table.chatId} is null and ${table.basedOnRunId} is null
        when 'chat' then ${table.chatId} is not null and ${table.taskId} is null and ${table.stationId} is null and ${table.basedOnRunId} is null
        else ${table.basedOnRunId} is not null and ${table.taskId} is not null and ${table.stationId} is not null and ${table.chatId} is null
      end`,
    ),
  ],
);
