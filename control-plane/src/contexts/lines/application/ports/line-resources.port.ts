import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINE_RESOURCES = Symbol('LINE_RESOURCES');

export interface LineRecord {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: string;
  readonly definition: LineDefinition;
}

export interface LineResourcesPort {
  withId(id: LineId): Promise<LineRecord | null>;

  at(teamId: TeamId, key: LineKey): Promise<LineRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineRecord[]>;

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly LineRecord[]>;
}
