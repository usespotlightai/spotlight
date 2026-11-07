import type {
  StationDeletionGuardPort,
  StationRelease,
} from '@lines/application/ports/station-deletion-guard.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  RESTRICT_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { inArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleStationDeletionGuard implements StationDeletionGuardPort {
  constructor(private readonly context: DrizzleContext) {}

  async lockedTaskCountsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>> {
    if (stationIds.length === 0) {
      return new Map();
    }

    const ids = stationIds.map((each) => each.value);

    await this.context.db
      .select({ id: workStation.stationId })
      .from(workStation)
      .where(inArray(workStation.stationId, ids))
      .orderBy(workStation.stationId)
      .for('update');

    const rows = await this.context.db
      .select({
        stationId: task.stationId,
        tasks: sql<number>`count(*)::int`,
      })
      .from(task)
      .where(inArray(task.stationId, ids))
      .groupBy(task.stationId);

    return new Map(rows.map((row) => [row.stationId, Number(row.tasks)]));
  }

  async release(stationIds: readonly StationId[]): Promise<StationRelease> {
    if (stationIds.length === 0) {
      return 'released';
    }

    try {
      await this.context.inSavepoint(() =>
        this.context.db.delete(workStation).where(
          inArray(
            workStation.stationId,
            stationIds.map((each) => each.value),
          ),
        ),
      );

      return 'released';
    } catch (error) {
      if (violates(error, RESTRICT_VIOLATION, 'task_station_fk')) {
        return 'occupied';
      }

      throw error;
    }
  }
}
