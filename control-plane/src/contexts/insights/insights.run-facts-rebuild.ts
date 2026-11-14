import { ProjectRunFacts } from '@insights/application/services/project-run-facts.service';
import { RebuildRunFacts } from '@insights/application/services/rebuild-run-facts.service';
import { DrizzleRunFacts } from '@insights/infrastructure/persistence/drizzle/projections/run-facts.projection';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { parseDatabaseEnv } from '@platform/config/env';
import {
  createDatabase,
  openPool,
} from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';

export interface RunFactsRebuild {
  readonly facts: RebuildRunFacts;
  readonly close: () => Promise<void>;
}

const READ_ONLY: DomainEventDispatcher = {
  dispatch: async () => {
    throw new Error('The run facts rebuild reads runs and never saves them');
  },
};

export const openRunFactsRebuild = (): RunFactsRebuild => {
  const env = parseDatabaseEnv();
  const pool = openPool(env, env.DATABASE_URL);
  const context = new DrizzleContext(createDatabase(pool));

  return {
    facts: new RebuildRunFacts(
      new ProjectRunFacts(
        new DrizzleRunRecordRepository(context, READ_ONLY),
        new DrizzleTaskHumanActionsRepository(context, READ_ONLY),
        new DrizzlePullRequestRecordRepository(context, READ_ONLY),
        new DrizzleRunFacts(context),
        context,
      ),
    ),
    close: () => pool.end(),
  };
};
