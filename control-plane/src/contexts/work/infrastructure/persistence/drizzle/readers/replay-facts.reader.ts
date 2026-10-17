import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  KnownRun,
  ReplayFactsPort,
} from '@work/application/ports/replay-facts.port';
import { originOfRun } from '@work/domain/services/task-origin';
import {
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceArchive } from '@work/infrastructure/persistence/drizzle/schemas/workspace-archive.schema';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleReplayFacts implements ReplayFactsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, KnownRun>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        runId: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        stationId: run.stationId,
        state: run.state,
        endedAt: run.endedAt,
        startedFromAt: run.startedFromAt,
        archiveId: run.startedFromArchiveId,
        briefed: isNotNull(run.briefedTask).mapWith(Boolean),
        liveTask: task.id,
        title: task.title,
        openedFrom: task.openedFrom,
        raisedAt: task.raisedAtStationId,
        keptArchive: workspaceArchive.id,
      })
      .from(run)
      .leftJoin(task, eq(task.id, run.taskId))
      .leftJoin(
        workspaceArchive,
        and(
          eq(workspaceArchive.id, run.startedFromArchiveId),
          eq(workspaceArchive.workspaceId, run.workspaceId),
          isNotNull(workspaceArchive.sealedAt),
        ),
      )
      .where(inArray(run.id, [...new Set(runIds)]));

    return new Map(
      rows.map((row) => [
        row.runId,
        {
          runId: row.runId,
          taskId: row.taskId,
          stationId: row.stationId,
          inWorkspace: row.workspaceId === workspaceId,
          ended: (TERMINAL_RUN_STATES as readonly RunState[]).includes(
            row.state,
          ),
          startedFrom: row.startedFromAt !== null,
          archive: row.archiveId ? (row.keptArchive ? 'kept' : 'gone') : 'none',
          briefed: row.briefed,
          taskExists: row.liveTask !== null,
          title: row.title,
          state: row.state,
          endedAt: row.endedAt,
          origin:
            row.openedFrom && row.stationId
              ? originOfRun({
                  openedFrom: TaskOrigin.of(row.openedFrom),
                  raisedAt: row.raisedAt,
                  ranAt: row.stationId,
                })
              : null,
        },
      ]),
    );
  }
}
