import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const DELIVERY_STATES = [
  'pending',
  'working',
  'done',
  'failed',
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const inboundDelivery = pgTable(
  'inbound_delivery',
  {
    source: text('source').notNull(),
    workspaceId: text('workspace_id').notNull().default(''),
    teamId: text('team_id').notNull().default(''),
    teamKey: text('team_key').notNull().default(''),
    id: text('id').notNull(),
    headers: jsonb('headers').notNull(),
    body: jsonb('body').notNull(),
    state: text('state').$type<DeliveryState>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamp('due_at').defaultNow().notNull(),
    claimedAt: timestamp('claimed_at'),
    failed: text('failed'),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    handledAt: timestamp('handled_at'),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.teamId, table.id] }),
    index('inbound_delivery_state_idx').on(table.state, table.dueAt),
  ],
);
