import { REPLAY_RUN_CLAIMS } from '@work/domain/value-objects/replay-run-claim.vo';
import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const replayRunClaimed = pgEnum('replay_run_claimed', REPLAY_RUN_CLAIMS);

export const replayRunClaim = pgTable('replay_run_claim', {
  runId: text('run_id').primaryKey(),
  claimedAs: replayRunClaimed('claimed_as').notNull(),
  unreplayableReason: text('unreplayable_reason'),
  reason: text('reason'),
  claimedAt: timestamp('claimed_at').defaultNow().notNull(),
});
