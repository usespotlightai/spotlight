import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class SkillUpdated implements ConfigurationChanged {
  readonly kind = 'skill.updated';

  constructor(
    readonly id: SkillDefinitionId,
    readonly teamId: TeamId,
    readonly key: DefinedSkillKey,
    readonly change: ConfigurationChange,
  ) {}
}
