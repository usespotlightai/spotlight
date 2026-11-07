import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import {
  RUN_JOURNAL_READER,
  type RunJournalReaderPort,
} from '@work/application/ports/run-journal-reader.port';
import {
  RUN_READER,
  type RunReaderPort,
  type TaskRunSummary,
} from '@work/application/ports/run-reader.port';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerTraceReader implements RunnerTraceReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(RUN_READER) private readonly runs: RunReaderPort,
    @Inject(RUN_JOURNAL_READER) private readonly journals: RunJournalReaderPort,
  ) {}

  async teamOfTask(taskId: TaskId): Promise<TeamId | null> {
    const [row] = await this.db
      .select({ teamId: workStation.teamId })
      .from(task)
      .innerJoin(workStation, eq(workStation.stationId, task.stationId))
      .where(eq(task.id, taskId.value))
      .limit(1);

    return row?.teamId ? TeamId.of(row.teamId) : null;
  }

  async runsForTask(taskId: TaskId): Promise<TaskRunSummary[]> {
    return (await this.runs.listForTask(taskId))?.found ?? [];
  }

  async journalsForTask(taskId: TaskId): Promise<RunJournal[]> {
    return (await this.journals.listForTask(taskId))?.found ?? [];
  }
}
