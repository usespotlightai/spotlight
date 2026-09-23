import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class SkillRedefined implements DomainEvent {
  readonly kind = 'configuration.skill-redefined';

  constructor(
    readonly id: SkillDefinitionId,
    readonly teamId: TeamId,
    readonly key: SkillKey,
  ) {}
}
