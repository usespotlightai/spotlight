import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  TaskPlacement,
  TaskPlacementsPort,
} from '@work/application/ports/task-placements.port';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskPlacements implements TaskPlacementsPort {
  constructor(private readonly context: DrizzleContext) {}

  async placementsAt(stationId: StationId): Promise<readonly TaskPlacement[]> {
    const rows = await this.context.db
      .select({ id: task.id, rank: task.rank })
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(asc(task.rank));

    return rows.map((row) => ({
      id: TaskId.of(row.id),
      rank: TaskRank.of(row.rank),
    }));
  }
}
