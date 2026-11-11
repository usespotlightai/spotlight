import { timestamptz } from '@platform/persistence/drizzle/columns';
import {
  CONFIGURATION_ACTIONS,
  type RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const CONFIGURATION_ACTORS = ['spotlight', 'person', 'token'] as const;

export const configurationAction = pgEnum(
  'configuration_action',
  CONFIGURATION_ACTIONS,
);
export const configurationActor = pgEnum(
  'configuration_actor',
  CONFIGURATION_ACTORS,
);

export const configurationChange = pgTable(
  'configuration_change',
  {
    seq: bigint('seq', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    workspaceId: text('workspace_id').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id').notNull(),
    key: text('key').notNull(),
    action: configurationAction('action').notNull(),
    actor: configurationActor('actor').notNull(),
    userId: text('user_id'),
    tokenId: text('token_id'),
    trustId: text('trust_id'),
    client: text('client'),
    details: jsonb('details').$type<RecordedDetail>().notNull().default({}),
    recordedAt: timestamptz('recorded_at').defaultNow().notNull(),
  },
  (table) => [
    index('configuration_change_workspace_idx').on(
      table.workspaceId,
      table.seq,
    ),
  ],
);
