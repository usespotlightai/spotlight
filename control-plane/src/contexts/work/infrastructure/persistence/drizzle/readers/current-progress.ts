import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  type Progress,
  progressOfCurrentRun,
} from '@work/domain/value-objects/run-state';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { inArray } from 'drizzle-orm';

export const progressOfCurrentRuns = async (
  db: DrizzleDatabase,
  runIds: readonly (string | null)[],
  answered: boolean,
): Promise<(runId: string | null) => Progress | null> => {
  const ids = runIds.filter((each): each is string => each !== null);
  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: run.id,
            state: run.state,
            stopRequestedAt: run.stopRequestedAt,
          })
          .from(run)
          .where(inArray(run.id, ids));
  const found = new Map(
    rows.map((row) => [
      row.id,
      { state: row.state, stopRequested: row.stopRequestedAt !== null },
    ]),
  );

  return (runId) =>
    runId === null
      ? null
      : progressOfCurrentRun(found.get(runId) ?? null, answered);
};
