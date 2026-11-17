import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const liveChannel = pgTable(
  'live_channel',
  {
    channel: text('channel').primaryKey(),
    lastSequence: bigint('last_sequence', { mode: 'number' }).notNull(),
  },
  (table) => [
    check(
      'live_channel_last_sequence_positive',
      sql`${table.lastSequence} > 0`,
    ),
  ],
);

export const liveNotice = pgTable(
  'live_notice',
  {
    channel: text('channel').notNull(),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    topic: text('topic').notNull(),
    ids: jsonb('ids').$type<Record<string, string>>().notNull(),
    recordedAt: timestamptz('recorded_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.channel, table.sequence] }),
    index('live_notice_recorded_at_idx').on(table.recordedAt),
  ],
);
