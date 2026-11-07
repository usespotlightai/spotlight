import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { RunFacts } from '@work/application/services/run-facts.service';
import { DrizzleRunJournals } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';

const NO_EVENTS = { dispatch: async () => {} };

export const runFactsOver = (db: DrizzleDatabase): RunFacts => {
  const context = new DrizzleContext(db);

  return new RunFacts(
    new DrizzleRunRepository(context, NO_EVENTS, telemetryInMemory()),
    new DrizzleWorkspaceArchiveRepository(context, NO_EVENTS),
  );
};

export const runJournalsOver = (db: DrizzleDatabase): DrizzleRunJournals =>
  new DrizzleRunJournals(db);
