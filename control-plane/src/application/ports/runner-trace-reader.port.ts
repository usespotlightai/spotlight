import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@application/ports/run-reader.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const RUNNER_TRACE_READER = Symbol('RUNNER_TRACE_READER');

/**
 * The read model behind an agent studying a trace. Its methods carry no
 * viewer: the application authorizes a runner by team before it reads, and the
 * port exists so that trust is stated in one place rather than spread through
 * the viewer-scoped readers.
 */
export interface RunnerTraceReaderPort {
  /**
   * The task a run is working, only where that run is the given runner's to act
   * on right now. Null otherwise, so a run it does not hold reveals nothing.
   */
  heldTaskOf(runId: RunId, runnerId: RunnerId): Promise<TaskId | null>;

  /** The team whose line the task stands on, or null where there is no task. */
  teamOfTask(taskId: TaskId): Promise<TeamId | null>;

  runsForTask(taskId: TaskId): Promise<TaskRunSummary[]>;

  journalsForTask(taskId: TaskId): Promise<RunJournal[]>;
}
