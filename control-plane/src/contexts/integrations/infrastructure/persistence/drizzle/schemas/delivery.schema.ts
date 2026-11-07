import { INBOUND_DELIVERY_STATES } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
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

export const deliveryState = pgEnum('delivery_state', INBOUND_DELIVERY_STATES);

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
    causeFiringId: text('cause_firing_id'),
    state: deliveryState('state').notNull(),
    attempts: integer('attempts').notNull(),
    dueAt: timestamptz('due_at').notNull(),
    claimedAt: timestamptz('claimed_at'),
    failed: text('failed'),
    receivedAt: timestamptz('received_at').notNull(),
    handledAt: timestamptz('handled_at'),
    version: integer('version').notNull().default(1),
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
