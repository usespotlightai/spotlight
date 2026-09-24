import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINE_RESOURCES = Symbol('LINE_RESOURCES');

export interface KeptLine {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>>;
}

export interface LineResourcesPort {
  withId(id: string): Promise<KeptLine | null>;

  at(teamId: TeamId, key: string): Promise<KeptLine | null>;

  ofTeam(teamId: TeamId): Promise<readonly KeptLine[]>;
}
