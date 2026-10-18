import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class SkillCreated implements ConfigurationChanged {
  readonly kind = 'configuration.skill-created';

  constructor(
    readonly id: SkillDefinitionId,
    readonly teamId: TeamId,
    readonly key: SkillKey,
    readonly change: ConfigurationChange,
  ) {}
}
