import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINES = Symbol('MEMORY_LINES');

export interface TeamLine {
  readonly id: LineId;
  readonly name: string;
  readonly stations: readonly {
    readonly id: StationId;
    readonly name: string;
  }[];
  readonly repositories: readonly Repository[];
}

export interface LinesPort {
  ofTeam(teamId: TeamId): Promise<readonly TeamLine[]>;
}
