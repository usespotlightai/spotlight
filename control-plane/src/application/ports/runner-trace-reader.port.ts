import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@application/ports/run-reader.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const RUNNER_TRACE_READER = Symbol('RUNNER_TRACE_READER');

// Not viewer-scoped: callers must authorize the runner by team before reading.
export interface RunnerTraceReaderPort {
  heldTaskOf(runId: RunId, runnerId: RunnerId): Promise<TaskId | null>;

  teamOfTask(taskId: TaskId): Promise<TeamId | null>;

  runsForTask(taskId: TaskId): Promise<TaskRunSummary[]>;

  journalsForTask(taskId: TaskId): Promise<RunJournal[]>;
}
