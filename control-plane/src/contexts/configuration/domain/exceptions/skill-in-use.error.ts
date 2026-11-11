import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';

export class SkillInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string, uses: StationUses<SkillKey>) {
    super(`Skill ${key} is in use. Stations using it: ${uses.stations}`);
    this.name = 'SkillInUseError';
  }
}
