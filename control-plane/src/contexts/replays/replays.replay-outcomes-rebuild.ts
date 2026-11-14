import { parseDatabaseEnv } from '@platform/config/env';
import {
  createDatabase,
  logPoolErrorToStderr,
  openPool,
} from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ReplayOutcomesRebuild } from '@replays/infrastructure/persistence/drizzle/projections/replay-outcomes-rebuild';
import { DrizzleReplayOutcomes } from '@replays/infrastructure/persistence/drizzle/projections/replay-outcomes.projection';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';

export interface ReplayOutcomesRebuildSession {
  readonly outcomes: ReplayOutcomesRebuild;
  readonly close: () => Promise<void>;
}

const READ_ONLY: DomainEventDispatcher = {
  dispatch: async () => {
    throw new Error(
      'The replay outcomes rebuild reads replays and never saves them',
    );
  },
};

export const openReplayOutcomesRebuild = (): ReplayOutcomesRebuildSession => {
  const env = parseDatabaseEnv();
  const pool = openPool(env, env.DATABASE_URL, logPoolErrorToStderr);
  const context = new DrizzleContext(createDatabase(pool));
  const outcomes = new DrizzleReplayOutcomes(context);

  return {
    outcomes: new ReplayOutcomesRebuild(
      context,
      new DrizzleReplayRepository(context, READ_ONLY, outcomes),
      outcomes,
    ),
    close: () => pool.end(),
  };
};
