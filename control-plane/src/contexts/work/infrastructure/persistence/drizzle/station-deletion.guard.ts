import type {
  LineSave,
  StationDeletionGuardPort,
  StationTaskCount,
} from '@lines/application/ports/station-deletion-guard.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import {
  workLine,
  workStation,
} from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { inArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleStationDeletionGuard implements StationDeletionGuardPort {
  constructor(private readonly context: DrizzleContext) {}

  async lockedTaskCountsAt(
    save: LineSave,
    stationIds: readonly StationId[],
  ): Promise<readonly StationTaskCount[]> {
    await this.supersedeOlderVersions(save);

    if (stationIds.length === 0) {
      return [];
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

    return rows.map((row) => ({
      stationId: StationId.of(row.stationId),
      tasks: row.tasks,
    }));
  }

  private async supersedeOlderVersions(save: LineSave): Promise<void> {
    await this.context.db
      .insert(workLine)
      .values({ lineId: save.lineId.value, savedVersion: save.version })
      .onConflictDoUpdate({
        target: workLine.lineId,
        set: {
          savedVersion: sql`greatest(coalesce(${workLine.savedVersion}, -1), excluded.saved_version)`,
        },
      });
  }

  async release(stationIds: readonly StationId[]): Promise<void> {
    if (stationIds.length === 0) {
      return;
    }

    await this.context.db.delete(workStation).where(
      inArray(
        workStation.stationId,
        stationIds.map((each) => each.value),
      ),
    );
  }
}
