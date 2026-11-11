import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { DrizzleRunJournals } from '@runs/infrastructure/persistence/drizzle/readers/run-journals';

const _NO_EVENTS = { dispatch: async () => {} };

export const runFactsOver = (db: DrizzleDatabase): RunReadModel => {
  const context = new DrizzleContext(db);

  return new RunReadModel(new DrizzleRunFactsReader(context));
};

export const runJournalsOver = (db: DrizzleDatabase): DrizzleRunJournals =>
  new DrizzleRunJournals(db);
