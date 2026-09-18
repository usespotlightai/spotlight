import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { StationColor } from '@work/domain/value-objects/station-color.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';

export interface TraceStation {
  readonly name: StationName;
  readonly color: StationColor;
  readonly position: number;
  readonly count: number;
}

export interface TeamTraceSummary {
  readonly taskId: TaskId;
  readonly title: string;
  readonly runIds: readonly RunId[];
  readonly station: TraceStation | null;
  readonly stations: readonly TraceStation[];
  readonly harness: HarnessName;
  readonly state: RunState;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly runs: number;
  readonly input: string | null;
  readonly output: string | null;
}

export const TEAM_TRACE_READER = Symbol('TEAM_TRACE_READER');

export interface TeamTraceReaderPort {
  listForTeam(
    teamId: TeamId,
    viewerId: UserId,
    since: Date,
  ): Promise<TeamTraceSummary[]>;
}
