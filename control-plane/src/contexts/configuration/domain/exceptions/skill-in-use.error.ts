import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SkillInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string, uses: StationUses) {
    super(`Skill ${key} is in use. Stations using it: ${uses.stations}`);
    this.name = 'SkillInUseError';
  }
}
