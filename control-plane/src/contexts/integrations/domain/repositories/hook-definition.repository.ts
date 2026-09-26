import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_DEFINITIONS = Symbol('HOOK_DEFINITIONS');

export interface HookDefinitionRepository {
  withId(id: HookDefinitionId): Promise<HookDefinition | null>;

  of(teamId: TeamId, key: HookKey): Promise<HookDefinition | null>;

  ofTeam(teamId: TeamId): Promise<readonly HookDefinition[]>;

  save(definition: HookDefinition): Promise<void>;
}
