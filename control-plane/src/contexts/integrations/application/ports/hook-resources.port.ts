import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_RESOURCES = Symbol('HOOK_RESOURCES');

export interface KeptHook {
  readonly id: string;
  readonly teamId: TeamId;
  readonly key: string;
  readonly version: number;
  readonly definition: Readonly<Record<string, unknown>>;
}

export interface HookResourcesPort {
  withId(id: string): Promise<KeptHook | null>;

  at(teamId: TeamId, key: string): Promise<KeptHook | null>;

  ofTeam(teamId: TeamId): Promise<readonly KeptHook[]>;
}
