import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HeldLine } from '@work/application/contracts/held-line.contract';

export const LINE_RESOURCES = Symbol('LINE_RESOURCES');

export interface KeptLine {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: string;
  readonly definition: HeldLine;
}

export interface LineResourcesPort {
  withId(id: string): Promise<KeptLine | null>;

  at(teamId: TeamId, key: string): Promise<KeptLine | null>;

  ofTeam(teamId: TeamId): Promise<readonly KeptLine[]>;

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly KeptLine[]>;
}
