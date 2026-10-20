import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { isQueued } from '@work/domain/value-objects/run-state';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { inArray } from 'drizzle-orm';

export const queuedAmong = async (
  db: DrizzleDatabase,
  runIds: readonly (string | null)[],
): Promise<ReadonlySet<string>> => {
  const ids = runIds.filter((each): each is string => each !== null);

  if (ids.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({
      id: run.id,
      state: run.state,
      stopRequestedAt: run.stopRequestedAt,
    })
    .from(run)
    .where(inArray(run.id, ids));

  return new Set(
    rows
      .filter((row) => isQueued(row.state, row.stopRequestedAt !== null))
      .map((row) => row.id),
  );
};
