import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { LineDefinition } from '@work/application/contracts/line-definition.contract';

export const LINE_RESOURCES = Symbol('LINE_RESOURCES');

export interface LineRecord {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: string;
  readonly definition: LineDefinition;
}

export interface LineResourcesPort {
  withId(id: string): Promise<LineRecord | null>;

  at(teamId: TeamId, key: string): Promise<LineRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineRecord[]>;

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly LineRecord[]>;
}
