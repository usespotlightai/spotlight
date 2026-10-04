import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HeldRun,
  HeldRunKind,
  RunnerActivityReaderPort,
} from '@work/application/ports/runner-activity-reader.port';
import { HELD_RUN_STATES } from '@work/domain/value-objects/run-state';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

const kindOf = (row: {
  taskId: string | null;
  chatId: string | null;
  searchId: string | null;
  replayOfRunId: string | null;
}): HeldRunKind => {
  if (row.chatId) {
    return 'chat';
  }
  if (row.searchId) {
    return 'search';
  }
  if (row.replayOfRunId) {
    return 'replay';
  }

  return row.taskId ? 'task' : 'spec';
};

@Injectable()
export class DrizzleRunnerActivityReader implements RunnerActivityReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async heldIn(workspaceId: WorkspaceId): Promise<readonly HeldRun[]> {
    const rows = await this.db
      .select({
        id: run.id,
        state: run.state,
        claimedBy: run.claimedBy,
        taskId: run.taskId,
        chatId: run.chatId,
        searchId: run.searchId,
        replayOfRunId: run.replayOfRunId,
        ranForTeamId: run.ranForTeamId,
        lineTeamId: line.teamId,
        chatTeamId: chat.teamId,
        taskTitle: task.title,
        chatTitle: chat.title,
      })
      .from(run)
      .leftJoin(task, eq(task.id, run.taskId))
      .leftJoin(
        station,
        eq(station.id, sql`coalesce(${run.stationId}, ${task.stationId})`),
      )
      .leftJoin(line, eq(line.id, station.lineId))
      .leftJoin(chat, eq(chat.id, run.chatId))
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          inArray(run.state, [...HELD_RUN_STATES]),
          isNotNull(run.claimedBy),
        ),
      );

    return rows.flatMap((row) => {
      if (!row.claimedBy) {
        return [];
      }

      const kind = kindOf(row);

      return [
        {
          runnerId: row.claimedBy,
          runId: row.id,
          state: row.state,
          kind,
          teamId: row.chatTeamId ?? row.lineTeamId ?? row.ranForTeamId,
          title:
            kind === 'chat'
              ? row.chatTitle
              : kind === 'task'
                ? row.taskTitle
                : null,
        },
      ];
    });
  }
}
