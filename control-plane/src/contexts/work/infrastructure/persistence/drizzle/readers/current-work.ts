import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  type Work,
  workOfCurrentRun,
} from '@work/domain/value-objects/run-state';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { inArray } from 'drizzle-orm';

export const workOfCurrentRuns = async (
  db: DrizzleDatabase,
  runIds: readonly (string | null)[],
): Promise<(runId: string | null) => Work | null> => {
  const ids = runIds.filter((each): each is string => each !== null);
  const rows =
    ids.length === 0
      ? []
      : await db
          .select({ id: run.id, state: run.state })
          .from(run)
          .where(inArray(run.id, ids));
  const found = new Map(rows.map((row) => [row.id, row]));

  return (runId) =>
    runId === null ? null : workOfCurrentRun(found.get(runId) ?? null);
};
