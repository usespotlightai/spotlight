import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { inArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleStationTallies implements StationTalliesPort {
  constructor(private readonly context: DrizzleContext) {}

  async taskCountsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>> {
    if (stationIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        stationId: task.stationId,
        tasks: sql<number>`count(*)::int`,
      })
      .from(task)
      .where(
        inArray(
          task.stationId,
          stationIds.map((each) => each.value),
        ),
      )
      .groupBy(task.stationId);

    return new Map(rows.map((row) => [row.stationId, Number(row.tasks)]));
  }

  async lockedTaskCountsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>> {
    if (stationIds.length === 0) {
      return new Map();
    }

    await this.context.db
      .select({ id: station.id })
      .from(station)
      .where(
        inArray(
          station.id,
          stationIds.map((each) => each.value),
        ),
      )
      .orderBy(station.id)
      .for('update');

    return this.taskCountsAt(stationIds);
  }
}
