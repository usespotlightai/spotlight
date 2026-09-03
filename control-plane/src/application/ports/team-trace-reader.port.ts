import type { HarnessName } from '@domain/value-objects/harness-name.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunState } from '@domain/value-objects/run-state';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** A station as the line holds it, which is what draws its mark. */
export interface TraceStation {
  readonly name: StationName;
  readonly color: StationColor;
  readonly position: number;
  // How many the line holds, without which a position says nothing.
  readonly count: number;
}

/**
 * One task as one trace: every run that worked it, what it was asked for and
 * what came back. Costs are not here — they are worked out from the journals
 * and joined on afterwards.
 */
export interface TeamTraceSummary {
  readonly taskId: TaskId;
  readonly title: string;
  readonly runIds: readonly RunId[];
  // Where the task stands now, and every station that has worked it, in the
  // order the line runs them. One task passes through several, and a column
  // that names only the last says the same thing on every finished row.
  readonly station: TraceStation | null;
  readonly stations: readonly TraceStation[];
  readonly harness: HarnessName;
  readonly state: RunState;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly runs: number;
  // What was asked of the task, and what its last run said back. The ask is
  // the task's own: a run's briefing is its station's prompt, which reads the
  // same on every task that station has ever worked.
  readonly input: string | null;
  readonly output: string | null;
}

export const TEAM_TRACE_READER = Symbol('TEAM_TRACE_READER');

export interface TeamTraceReaderPort {
  /**
   * Newest first, of the runs that started since the given moment. Bounded at
   * the query rather than after it: a team's whole history is not read to show
   * an hour of it.
   */
  listForTeam(
    teamId: TeamId,
    viewerId: UserId,
    since: Date,
  ): Promise<TeamTraceSummary[]>;
}
