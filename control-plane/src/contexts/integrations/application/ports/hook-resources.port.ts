import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_RESOURCES = Symbol('HOOK_RESOURCES');

export interface HookRecord {
  readonly id: string;
  readonly teamId: TeamId;
  readonly key: string;
  readonly version: number;
  readonly definition: Readonly<Record<string, unknown>>;
}

export interface HookResourcesPort {
  withId(id: string): Promise<HookRecord | null>;

  at(teamId: TeamId, key: string): Promise<HookRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly HookRecord[]>;
}
