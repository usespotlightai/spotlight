import type { RunJournal } from '@runs/application/contracts/run-journal.contract';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TaskRunSummary } from '@work/application/ports/run-reader.port';

export const RUNNER_TRACE_READER = Symbol('RUNNER_TRACE_READER');

// Not viewer-scoped. Callers must authorize the runner by team before they read.
export interface RunnerTraceReaderPort {
  teamOfTask(taskId: TaskId): Promise<TeamId | null>;

  runsForTask(taskId: TaskId): Promise<TaskRunSummary[]>;

  journalsForTask(taskId: TaskId): Promise<RunJournal[]>;
}
