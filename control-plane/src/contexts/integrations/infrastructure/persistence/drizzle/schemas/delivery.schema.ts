import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const DELIVERY_STATES = [
  'pending',
  'working',
  'done',
  'failed',
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const deliveryState = pgEnum('delivery_state', DELIVERY_STATES);

export const inboundDelivery = pgTable(
  'inbound_delivery',
  {
    seq: bigint('seq', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    integration: text('integration').notNull(),
    workspaceId: text('workspace_id'),
    teamId: text('team_id'),
    teamKey: text('team_key'),
    id: text('id').notNull(),
    headers: jsonb('headers').notNull(),
    body: jsonb('body').notNull(),
    state: deliveryState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamptz('due_at').defaultNow().notNull(),
    claimedAt: timestamptz('claimed_at'),
    failed: text('failed'),
    receivedAt: timestamptz('received_at').defaultNow().notNull(),
    handledAt: timestamptz('handled_at'),
  },
  (table) => [
    check(
      'inbound_delivery_attempts_not_negative',
      sql`${table.attempts} >= 0`,
    ),
    unique('inbound_delivery_key')
      .on(table.integration, table.teamId, table.id)
      .nullsNotDistinct(),
    check(
      'inbound_delivery_whole_addressee',
      sql`num_nonnulls(${table.workspaceId}, ${table.teamId}, ${table.teamKey}) in (0, 3)`,
    ),
    index('inbound_delivery_state_idx').on(table.state, table.dueAt),
  ],
);
