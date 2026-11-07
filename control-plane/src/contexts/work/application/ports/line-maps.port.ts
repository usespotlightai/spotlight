import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const LINE_MAPS = Symbol('LINE_MAPS');

export interface StationCandidateRequest {
  readonly lineId: LineId;
  readonly stationKey: string;
  readonly block: unknown;
  readonly repositories?: unknown;
}

export type StationCandidate =
  | {
      readonly ok: true;
      readonly line: LineMap;
      readonly definition: LineDefinition;
    }
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

export interface LineMapsPort {
  find(id: LineId): Promise<LineMap | null>;

  findByStation(stationId: StationId): Promise<LineMap | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineMap[]>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly LineMap[]>;

  candidate(request: StationCandidateRequest): Promise<StationCandidate>;
}
