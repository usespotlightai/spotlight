import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { PERSON_ACTS } from '@outcomes/domain/value-objects/next-act.vo';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const runRecordEnding = pgEnum('run_record_ending', RUN_ENDINGS);
export const runRecordChecks = pgEnum('run_record_checks', CHECK_VERDICTS);
export const runRecordAct = pgEnum('run_record_act', PERSON_ACTS);
export const taskDeliveryState = pgEnum('task_delivery_state', DELIVERY_STATES);

export const runRecord = pgTable(
  'run_record',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    lineId: text('line_id'),
    stationId: text('station_id'),
    taskId: text('task_id'),
    fingerprint: text('fingerprint'),
    endedAt: timestamp('ended_at'),
    ending: runRecordEnding('ending'),
    failure: text('failure'),
    round: integer('round'),
    superseded: boolean('superseded').notNull().default(false),
    checks: runRecordChecks('checks'),
    nextAct: runRecordAct('next_act'),
    nextAt: timestamp('next_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('run_record_station_idx').on(table.stationId, table.endedAt),
    index('run_record_task_idx').on(table.taskId, table.endedAt),
    index('run_record_workspace_idx').on(table.workspaceId),
  ],
);

export const taskDelivery = pgTable(
  'task_delivery',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    state: taskDeliveryState('state').notNull().default('open'),
    closedAt: timestamp('closed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_delivery_pull_request_idx').on(
      table.workspaceId,
      table.pullRequest,
    ),
  ],
);
