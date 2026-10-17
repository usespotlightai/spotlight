import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@work/application/ports/run-reader.port';

export const RUNNER_TRACE_READER = Symbol('RUNNER_TRACE_READER');

export interface LeasedRunFacts {
  readonly teamId: TeamId;
  readonly replaysFrom: Date | null;
  readonly isSearch: boolean;
}

// Not viewer-scoped. Callers must authorize the runner by team before they read.
export interface RunnerTraceReaderPort {
  leasedRunFacts(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<LeasedRunFacts | null>;

  teamOfTask(taskId: TaskId): Promise<TeamId | null>;

  runsForTask(taskId: TaskId): Promise<TaskRunSummary[]>;

  journalsForTask(taskId: TaskId): Promise<RunJournal[]>;
}
