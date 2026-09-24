import type { RecordedDetail } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const configurationChange = pgTable(
  'configuration_change',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id').notNull(),
    key: text('key').notNull(),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    userId: text('user_id'),
    tokenId: text('token_id'),
    client: text('client'),
    details: jsonb('details').$type<RecordedDetail>().notNull().default({}),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => [
    index('configuration_change_workspace_idx').on(
      table.workspaceId,
      table.seq,
    ),
  ],
);
