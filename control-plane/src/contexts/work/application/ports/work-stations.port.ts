import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK_STATIONS = Symbol('WORK_STATIONS');

export type ProjectedStationKind = 'backlog' | 'work' | 'completed';

export interface ProjectedStation {
  readonly id: StationId;
  readonly key: string;
  readonly name: string;
  readonly kind: ProjectedStationKind;
  readonly color: string;
  readonly position: number;
}

export interface ProjectedLine {
  readonly lineId: LineId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly version: number;
  readonly key: string;
  readonly name: string;
  readonly stations: readonly ProjectedStation[];
}

export interface WorkStationsPort {
  project(line: ProjectedLine): Promise<void>;
}
