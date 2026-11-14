import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { eq, sql } from 'drizzle-orm';

import * as schema from './schema';

type TaskInsert = Omit<typeof schema.task.$inferInsert, 'teamId' | 'number'>;

export const insertTask = async (
  db: DrizzleDatabase,
  tasks: TaskInsert | readonly TaskInsert[],
): Promise<void> => {
  for (const each of ([] as readonly TaskInsert[]).concat(tasks)) {
    const [station] = await db
      .select({ teamId: schema.workStation.teamId })
      .from(schema.workStation)
      .where(eq(schema.workStation.stationId, each.stationId));

    if (!station) {
      throw new Error(`No projected station ${each.stationId}`);
    }

    await db
      .insert(schema.workTeam)
      .values({ teamId: station.teamId, key: station.teamId })
      .onConflictDoNothing();

    const [counted] = await db
      .update(schema.workTeam)
      .set({ nextNumber: sql`${schema.workTeam.nextNumber} + 1` })
      .where(eq(schema.workTeam.teamId, station.teamId))
      .returning({ number: sql<number>`${schema.workTeam.nextNumber} - 1` });

    await db
      .insert(schema.task)
      .values({ ...each, teamId: station.teamId, number: counted.number });
  }
};
